/* eslint-disable prettier/prettier */
/* eslint-disable no-unused-vars */
import * as dotenv from "dotenv";
import * as ethers from "ethers";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

export const RINKEBY_CHAIN_ID = 4;
export const BINANCE_CHAIN_ID = 97;
export const TWENTY_ONE_MIL_TOKENS = ethers.utils.parseUnits("21000000");
export const ONE_MIL_TOKENS = ethers.utils.parseUnits("1000000");
export const TOKEN_NAME = "Some Token";
export const TOKEN_SYMBOL = "SMTKN";
export const FIVE_TOKENS = ethers.utils.parseUnits("5");
export const ONE_TOKEN = ethers.utils.parseUnits("1");

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
  .addParam("bridge", "Bridge address")
  .addParam("token", "Source token address")
  .addParam("amount", "Amount to swap")
  .addParam("chainfrom", "Id of chain from")
  .addParam("chainto", "Id of chain to")
  .addParam("nonce", "Unique value that will make transaction unique")
  .addParam("symbol", "Symbol of token")
  .setAction(async (taskArguments, hre) => {
      const contractSchema = require("./artifacts/contracts/Bridge.sol/Bridge.json");

      const alchemyProvider = new hre.ethers.providers.AlchemyProvider("rinkeby", process.env.ALCHEMY_KEY);
      const walletOwner = new hre.ethers.Wallet(process.env.METAMASK_PRIVATE_KEY, alchemyProvider);
      const bridge = new hre.ethers.Contract(taskArguments.bridge, contractSchema.abi, walletOwner);

      const provider = new hre.ethers.providers.WebSocketProvider("https://data-seed-prebsc-1-s1.binance.org:8545");
      const filter = bridge.filters.swapInitialized(
        process.env.METAMASK_PUBLIC_KEY, taskArguments.token, null, null, null, null, null
      );
      provider.on(filter, (event) => console.log("Swap initialized event:", event));

      const swapTx = await bridge.swap(
        taskArguments.token, 
        taskArguments.amount, 
        taskArguments.chainfrom,
        taskArguments.chainto,
        taskArguments.nonce,
        taskArguments.symbol
      );

      console.log("Receipt: ", swapTx);
  })
;

task("redeem", "Swap ERC20 tokens")
  .addParam("bridge", "Bridge address")
  .addParam("token", "Source token address")
  .addParam("amount", "Amount to swap")
  .addParam("chainfrom", "Id of chain from")
  .addParam("chainto", "Id of chain to")
  .addParam("nonce", "Unique value that will make transaction unique")
  .addParam("symbol", "Symbol of token")
  .addParam("signature", "Signature")
  .setAction(async (taskArguments, hre) => {
      const contractSchema = require("./artifacts/contracts/Bridge.sol/Bridge.json");

      const alchemyProvider = new hre.ethers.providers.AlchemyProvider("rinkeby", process.env.ALCHEMY_KEY);
      const walletOwner = new hre.ethers.Wallet(process.env.METAMASK_PRIVATE_KEY, alchemyProvider);
      const bridge = new hre.ethers.Contract(taskArguments.bridge, contractSchema.abi, walletOwner);

      const provider = new hre.ethers.providers.WebSocketProvider("https://data-seed-prebsc-1-s1.binance.org:8545");
      const filter = bridge.filters.swapFinalized(
        process.env.METAMASK_PUBLIC_KEY, taskArguments.token, null, null, null, null, null
      );
      provider.on(filter, (event) => console.log("Swap finalized event:", event));

      const swapTx = await bridge.redeem(
        taskArguments.token, 
        taskArguments.amount, 
        taskArguments.chainfrom,
        taskArguments.chainto,
        taskArguments.nonce,
        taskArguments.symbol
      );

      console.log("Receipt: ", swapTx);
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
    bsctest: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: [process.env.METAMASK_PRIVATE_KEY],
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
