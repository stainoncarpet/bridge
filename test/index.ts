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
  let user1: { address: any; }, user2: { address: any; };

  before(async () => {
    const signers = await ethers.getSigners();

    signatureAuthority = signers[14];
    user1 = signers[1];
    user2 = signers[2];

    Token = await ethers.getContractFactory("Token");
    tokenETH = await Token.deploy(TWENTY_ONE_MIL_TOKENS, TOKEN_NAME, TOKEN_SYMBOL);
    tokenBNB = await Token.deploy(TWENTY_ONE_MIL_TOKENS, TOKEN_NAME, TOKEN_SYMBOL);
    await tokenETH.deployed();
    await tokenBNB.deployed();

    Bridge = await ethers.getContractFactory("Bridge");
    bridgeETH = await Bridge.deploy(tokenETH.address, signatureAuthority.address);
    bridgeBNB = await Bridge.deploy(tokenBNB.address, signatureAuthority.address);
    await bridgeETH.deployed();
    await bridgeBNB.deployed();

    await tokenETH.setBridge(bridgeETH.address);
    await tokenBNB.setBridge(bridgeBNB.address);

    // console.log("user1", user1.address, "user2", user2.address);
    // console.log("bridge eth", bridgeETH.address, "token eth", tokenETH.address);
    // console.log("bridge bnb", bridgeBNB.address, "token ити", tokenBNB.address);
    // console.log("authority", signatureAuthority.address);

    await tokenETH.connect(signers[0]).transfer(user1.address, ONE_MIL_TOKENS);
    await tokenBNB.connect(signers[0]).transfer(user1.address, ONE_MIL_TOKENS);
  });

  // beforeEach(async () => { });

  it("Should initialize swap and burn swapped amount", async () => {
    const totalSupplyBeforeSwap = await tokenETH.totalSupply();
    const userBalanceBeforeSwap = await tokenETH.balanceOf(user1.address);
    // allow bridge to manage 1 tokenETH
    await tokenETH.connect(user1).approve(bridgeETH.address, ONE_TOKEN);

    const swapArgs = [
      user2.address,
      ONE_TOKEN,
      RINKEBY_CHAIN_ID,
      BINANCE_CHAIN_ID,
      0,
      TOKEN_SYMBOL
    ];

    // sending to a friend
    expect(await bridgeETH.connect(user1).swap(...swapArgs))
    .to.emit(bridgeETH, "swapInitialized").withArgs(...swapArgs)
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
      user2.address,
      FIVE_TOKENS,
      RINKEBY_CHAIN_ID,
      BINANCE_CHAIN_ID,
      0,
      TOKEN_SYMBOL
    ];

    // sending to a friend
    expect(await bridgeETH.connect(user1).swap(...swapArgs))
    .to.emit(bridgeETH, "swapInitialized").withArgs(...swapArgs)
    ;

    // should revert if same agruments
    expect(bridgeETH.connect(user1).swap(...swapArgs))
    .to.be.revertedWith("Swap already registered");

    const message = ethers.utils.solidityKeccak256(
			["address", "uint256", "uint256", "uint256", "uint256", "string"],
			[...swapArgs]
    )

    const signature = await signatureAuthority.signMessage(ethers.utils.arrayify(message));

    // user2 shouldn't have any tokens yet
    expect(await tokenBNB.balanceOf(user2.address)).to.be.equal(0);

    expect(await bridgeBNB.connect(user2).redeem(...swapArgs, signature))
    .to.emit(bridgeBNB, "swapFinalized")
    .withArgs(...swapArgs)
    ;

    // should revert if trying to redeem twice
    expect(bridgeBNB.connect(user2).redeem(...swapArgs, signature))
    .to.be.revertedWith("Swap already registered or data is corrupt");

    expect(await tokenBNB.balanceOf(user2.address)).to.be.equal(FIVE_TOKENS);

    const totalSupplyAfterSwap = await tokenBNB.totalSupply();

    expect(totalSupplyBeforeSwap.add(FIVE_TOKENS)).to.be.equal(totalSupplyAfterSwap);
  });
});