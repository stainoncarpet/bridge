/* eslint-disable prettier/prettier */
/* eslint-disable node/no-missing-import */

import { ethers } from "hardhat";
import { TOKEN_NAME, TOKEN_SYMBOL, TWENTY_ONE_MIL_TOKENS } from "../hardhat.config";

const main = async () => {
  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy(TWENTY_ONE_MIL_TOKENS, TOKEN_NAME, TOKEN_SYMBOL);
  await token.deployed();

  const Bridge = await ethers.getContractFactory("Bridge");
  const bridge = await Bridge.deploy();
  await bridge.deployed();

  console.log("Token deployed to:", token.address, "by", await token.signer.getAddress());
  console.log("Bridge deployed to:", bridge.address, "by", await bridge.signer.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
