/* eslint-disable prettier/prettier */
/* eslint-disable no-unused-vars */
import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config();

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ETHERSCAN_API_KEY: string;
      ALCHEMY_KEY: string;
      METAMASK_PRIVATE_KEY: string;
      METAMASK_PUBLIC_KEY: string;
      COINMARKETCAP_API_KEY: string;
      RINKEBY_URL: string;
    }
  }
}

task("swap", "Swap ERC20 tokens")
  .addParam("", "")
  .setAction(async (taskArguments, hre) => {
      const contractSchema = require("./artifacts/contracts/Bridge.sol/Bridge.json");

      const alchemyProvider = new hre.ethers.providers.AlchemyProvider("rinkeby", process.env.ALCHEMY_KEY);
      const walletOwner = new hre.ethers.Wallet(process.env.METAMASK_PRIVATE_KEY, alchemyProvider);
      const bridge = new hre.ethers.Contract(taskArguments., contractSchema.abi, walletOwner);

      // recipient, amount, chainfrom, chainto, nonce, symbol
      const swapTx = await bridge.swap(taskArguments.tokenuri, taskArguments.owner);

      console.log("Receipt: ", swapTx);
  })
;

task("redeem", "Swap ERC20 tokens")
  .addParam("", "")
  .setAction(async (taskArguments, hre) => {
      const contractSchema = require("./artifacts/contracts/Bridge.sol/Bridge.json");

      const alchemyProvider = new hre.ethers.providers.AlchemyProvider("rinkeby", process.env.ALCHEMY_KEY);
      const walletOwner = new hre.ethers.Wallet(process.env.METAMASK_PRIVATE_KEY, alchemyProvider);
      const bridge = new hre.ethers.Contract(taskArguments., contractSchema.abi, walletOwner);

      // recipient, amount, chainfrom, chainto, nonce, symbol
      const redeemTx = await bridge.redeem(taskArguments.tokenuri, taskArguments.owner);

      console.log("Receipt: ", redeemTx);
  })
;

const config: HardhatUserConfig = {
  solidity: "0.8.11",
  networks: {
    rinkeby: {
      url: process.env.RINKEBY_URL,
      accounts: [process.env.METAMASK_PRIVATE_KEY],
      gas: 2100000,
      gasPrice: 8000000000
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
