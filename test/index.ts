/* eslint-disable prettier/prettier */

import { expect } from "chai";
import { ethers } from "hardhat";

const RINKEBY_CHAIN_ID = 4;
const BINANCE_CHAIN_ID = 97;
const TWENTY_ONE_MIL_TOKENS = ethers.utils.parseUnits("21000000");
const ONE_MIL_TOKENS = ethers.utils.parseUnits("1000000");
const TOKEN_NAME = "Some Token";
const TOKEN_SYMBOL = "SMTKN";
const FIVE_TOKENS = ethers.utils.parseUnits("5");
const ONE_TOKEN = ethers.utils.parseUnits("1");

describe("Token & Bridge", () => {
  let Bridge: any, bridgeETH: any, bridgeBNB: any, Token: any, tokenETH: any, tokenBNB: any, signatureAuthority: any;
  let user1: { address: any; };

  before(async () => {
    const signers = await ethers.getSigners();

    signatureAuthority = signers[14];
    user1 = signers[1];

    Token = await ethers.getContractFactory("Token");
    tokenETH = await Token.deploy(TWENTY_ONE_MIL_TOKENS, TOKEN_NAME, TOKEN_SYMBOL);
    tokenBNB = await Token.deploy(TWENTY_ONE_MIL_TOKENS, TOKEN_NAME, TOKEN_SYMBOL);
    await tokenETH.deployed();
    await tokenBNB.deployed();

    Bridge = await ethers.getContractFactory("Bridge");
    bridgeETH = await Bridge.deploy(signatureAuthority.address);
    bridgeBNB = await Bridge.deploy(signatureAuthority.address);
    await bridgeETH.deployed();
    await bridgeBNB.deployed();

    await tokenETH.setBridge(bridgeETH.address);
    await tokenBNB.setBridge(bridgeBNB.address);

    await bridgeETH.includeToken(tokenETH.address, tokenBNB.address, TOKEN_SYMBOL);
    await bridgeBNB.includeToken(tokenETH.address, tokenBNB.address, TOKEN_SYMBOL);

    await bridgeETH.updateChainById(RINKEBY_CHAIN_ID);
    await bridgeETH.updateChainById(BINANCE_CHAIN_ID);
    await bridgeBNB.updateChainById(RINKEBY_CHAIN_ID);
    await bridgeBNB.updateChainById(BINANCE_CHAIN_ID);

    // console.log("user1", user1.address);
    // console.log("bridge eth", bridgeETH.address, "token eth", tokenETH.address);
    // console.log("bridge bnb", bridgeBNB.address, "token ити", tokenBNB.address);
     console.log("authority", signatureAuthority.address);

    await tokenETH.connect(signers[0]).transfer(user1.address, ONE_MIL_TOKENS);
  });

  // beforeEach(async () => { });

  it("Should initialize swap and burn swapped amount", async () => {
    const totalSupplyBeforeSwap = await tokenETH.totalSupply();
    const userBalanceBeforeSwap = await tokenETH.balanceOf(user1.address);
    // allow bridge to manage 1 tokenETH
    await tokenETH.connect(user1).approve(bridgeETH.address, ONE_TOKEN);

    const swapArgs = [
      tokenETH.address,
      ONE_TOKEN,
      RINKEBY_CHAIN_ID,
      BINANCE_CHAIN_ID,
      0,
      TOKEN_SYMBOL
    ];

    expect(await bridgeETH.connect(user1).swap(...swapArgs))
      .to.emit(bridgeETH, "swapInitialized").withArgs(user1.address, ...swapArgs)
      ;

    const totalSupplyAfterSwap = await tokenETH.totalSupply();
    const userBalanceAfterSwap = await tokenETH.balanceOf(user1.address);

    expect(totalSupplyBeforeSwap.sub(totalSupplyAfterSwap)).to.be.equal(ONE_TOKEN);
    expect(userBalanceBeforeSwap.sub(userBalanceAfterSwap)).to.be.equal(ONE_TOKEN);
  });

  it("Should finalize swap and mint swapped amount", async () => {
    const totalSupplyBeforeSwap = await tokenBNB.totalSupply();

    await tokenETH.connect(user1).approve(bridgeETH.address, FIVE_TOKENS);

    const swapArgs = [
      tokenETH.address,
      FIVE_TOKENS,
      RINKEBY_CHAIN_ID,
      BINANCE_CHAIN_ID,
      0,
      TOKEN_SYMBOL
    ];

    expect(await bridgeETH.connect(user1).swap(...swapArgs))
      .to.emit(bridgeETH, "swapInitialized").withArgs(...swapArgs)
    ;

    // should revert if same agruments
    expect(bridgeETH.connect(user1).swap(...swapArgs))
      .to.be.revertedWith("Swap already registered")
    ;

    const message = ethers.utils.solidityKeccak256(
      ["address", "address", "uint256", "uint256", "uint256", "uint256", "string"],
      [user1.address, ...swapArgs]
    );

    const signature = await signatureAuthority.signMessage(ethers.utils.arrayify(message));

    expect(await tokenBNB.balanceOf(user1.address)).to.be.equal(0);

    expect(await bridgeBNB.connect(user1).redeem(...swapArgs, signature))
      .to.emit(bridgeBNB, "swapFinalized")
      .withArgs(user1.address, tokenBNB.address, ...swapArgs.slice(1))
    ;

    // should revert if trying to redeem twice
    expect(bridgeBNB.connect(user1).redeem(...swapArgs, signature))
      .to.be.revertedWith("Swap already registered or data is corrupt")
    ;

    expect(await tokenBNB.balanceOf(user1.address)).to.be.equal(FIVE_TOKENS);

    const totalSupplyAfterSwap = await tokenBNB.totalSupply();

    expect(totalSupplyBeforeSwap.add(FIVE_TOKENS)).to.be.equal(totalSupplyAfterSwap);
  });
});