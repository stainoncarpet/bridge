/* eslint-disable node/no-missing-import */
/* eslint-disable prettier/prettier */

import { expect } from "chai";
import { ethers } from "hardhat";
import { TWENTY_ONE_MIL_TOKENS, RINKEBY_CHAIN_ID, BINANCE_CHAIN_ID, ONE_MIL_TOKENS, TOKEN_NAME, TOKEN_SYMBOL, FIVE_TOKENS, ONE_TOKEN } from "../hardhat.config";

describe("Token & Bridge", () => {
  let Bridge: any, bridgeETH: any, bridgeBNB: any, Token: any, tokenETH: any, tokenBNB: any, signatureAuthority: any;
  let user1: { address: any; };
  let signers: any[];

  beforeEach(async () => {
    signers = await ethers.getSigners();

    signatureAuthority = signers[14];
    user1 = signers[1];

    Token = await ethers.getContractFactory("Token");
    tokenETH = await Token.deploy(TWENTY_ONE_MIL_TOKENS, TOKEN_NAME, TOKEN_SYMBOL);
    tokenBNB = await Token.deploy(TWENTY_ONE_MIL_TOKENS, TOKEN_NAME, TOKEN_SYMBOL);
    await tokenETH.deployed();
    await tokenBNB.deployed();

    Bridge = await ethers.getContractFactory("Bridge");
    bridgeETH = await Bridge.deploy();
    bridgeBNB = await Bridge.deploy();
    await bridgeETH.deployed();
    await bridgeBNB.deployed();

    await tokenETH.setBridge(bridgeETH.address);
    await tokenBNB.setBridge(bridgeBNB.address);

    await bridgeETH.setValidator(signatureAuthority.address);
    await bridgeBNB.setValidator(signatureAuthority.address);

    await bridgeETH.includeToken(tokenETH.address, tokenBNB.address, TOKEN_SYMBOL);
    await bridgeBNB.includeToken(tokenETH.address, tokenBNB.address, TOKEN_SYMBOL);

    await bridgeETH.updateChainById(RINKEBY_CHAIN_ID);
    await bridgeETH.updateChainById(BINANCE_CHAIN_ID);
    await bridgeBNB.updateChainById(RINKEBY_CHAIN_ID);
    await bridgeBNB.updateChainById(BINANCE_CHAIN_ID);

    await tokenETH.connect(signers[0]).transfer(user1.address, ONE_MIL_TOKENS);
  });

  it("Should get destroyed", async () => {
    expect(await tokenETH.owner()).to.equal(signers[0].address);
    expect(await tokenBNB.owner()).to.equal(signers[0].address);
    expect(await bridgeETH.owner()).to.equal(signers[0].address);
    expect(await bridgeBNB.owner()).to.equal(signers[0].address);

    await expect(tokenETH.connect(signers[1]).destroyContract()).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(tokenBNB.connect(signers[1]).destroyContract()).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(bridgeETH.connect(signers[1]).destroyContract()).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(bridgeBNB.connect(signers[1]).destroyContract()).to.be.revertedWith("Ownable: caller is not the owner");

    await tokenETH.destroyContract();
    await tokenBNB.destroyContract();
    await bridgeETH.destroyContract();
    await bridgeBNB.destroyContract();

    await expect(tokenETH.owner()).to.be.reverted;
    await expect(tokenBNB.owner()).to.be.reverted;
    await expect(bridgeETH.owner()).to.be.reverted;
    await expect(bridgeBNB.owner()).to.be.reverted;
  });

  it("Should initialize swap and burn swapped amount", async () => {
    const totalSupplyBeforeSwap = await tokenETH.totalSupply();
    const userBalanceBeforeSwap = await tokenETH.balanceOf(user1.address);

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

    expect(bridgeBNB.connect(user1).redeem(...swapArgs, signature))
      .to.be.revertedWith("Swap already registered or data is corrupt")
    ;

    expect(await tokenBNB.balanceOf(user1.address)).to.be.equal(FIVE_TOKENS);

    const totalSupplyAfterSwap = await tokenBNB.totalSupply();

    expect(totalSupplyBeforeSwap.add(FIVE_TOKENS)).to.be.equal(totalSupplyAfterSwap);
  });

  it("Should remove chain id and not allow to make swaps involving it", async () => {
    await tokenETH.connect(user1).approve(bridgeETH.address, ONE_TOKEN);

    const swapArgs = [
      tokenETH.address,
      ONE_TOKEN,
      RINKEBY_CHAIN_ID,
      BINANCE_CHAIN_ID,
      0,
      TOKEN_SYMBOL
    ];

    expect(await bridgeETH.updateChainById(RINKEBY_CHAIN_ID))
      .to.emit(bridgeETH, "chainUpdated").withArgs(RINKEBY_CHAIN_ID, false)
    ;

    expect(bridgeETH.connect(user1).swap(...swapArgs))
      .to.be.revertedWith("Chain is not available")
    ;
  });

  it("Should exclude token and not allow to make swaps involving it", async () => {
    await tokenETH.connect(user1).approve(bridgeETH.address, ONE_TOKEN);

    const swapArgs = [
      tokenETH.address,
      ONE_TOKEN,
      RINKEBY_CHAIN_ID,
      BINANCE_CHAIN_ID,
      0,
      TOKEN_SYMBOL
    ];

    expect(await bridgeETH.excludeToken(RINKEBY_CHAIN_ID))
      .to.emit(bridgeETH, "tokenExcluded").withArgs(TOKEN_SYMBOL)
    ;

    expect(bridgeETH.connect(user1).swap(...swapArgs))
      .to.be.revertedWith("Token is not available")
    ;
  });

  it("Only bridge should be able to mint and burn", async () => {
    expect(tokenETH.mint(user1.address, FIVE_TOKENS))
      .to.be.revertedWith("Only bridge can perform this action")
    ;

    expect(tokenETH.burn(user1.address, FIVE_TOKENS))
      .to.be.revertedWith("Only bridge can perform this action")
    ;
  });
});