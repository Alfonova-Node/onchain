import { getFullnodeUrl, SuiClient } from "@mysten/sui.js/client";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import axios from "axios";
import delay from "delay";
import moment from "moment";
import chalk from "chalk";
import fs from "fs";

// Read and parse mnemonic data from file
const READ_MNEMONIC = fs.readFileSync("./mnemonic.json", "utf-8");
const SUI_MNEMONIC_ARRAY = JSON.parse(READ_MNEMONIC);

const CLAIM_PACKAGE_ID =
  "0x1efaf509c9b7e986ee724596f526a22b474b15c376136772c00b8452f204d2d1";
const CLAIM_OBJECT_ID =
  "0x4846a1f1030deffd9dea59016402d832588cf7e0c27b9e4c1a63d2b5e152873a";
const OCEAN_PACKAGE_ID =
  "0xa8816d3a6e3136e86bc2873b1f94a15cadc8af2703c075f2d546c2ae367f4df9";

// Construct and sign the claim transaction
const makeClaimTx = async (client, keypair, sender) => {
  try {
    const gasBudget = "10000000";
    const tx = new TransactionBlock();
    tx.moveCall({
      target: `${CLAIM_PACKAGE_ID}::game::claim`,
      arguments: [tx.object(CLAIM_OBJECT_ID), tx.object("0x6")],
    });
    tx.setGasBudget(gasBudget);
    tx.setSender(sender);

    const { bytes, signature } = await tx.sign({ client, signer: keypair });
    return { bytes, signature };
  } catch (error) {
    throw error;
  }
};

// Send the signed transaction to the blockchain
const sendTransaction = async (client, bytes, signature) => {
  try {
    await client.dryRunTransactionBlock({ transactionBlock: bytes });
    const result = await client.executeTransactionBlock({
      signature,
      transactionBlock: bytes,
      requestType: "WaitForLocalExecution",
      options: { showEffects: true },
    });
    return result;
  } catch (error) {
    throw error;
  }
};

// Get the remaining time until the next claim is allowed
const getTimeLeft = async (address) => {
  try {
    const response = await axios.post(
      "https://fullnode.mainnet.sui.io/",
      {
        jsonrpc: "2.0",
        id: 76,
        method: "suix_getDynamicFieldObject",
        params: [CLAIM_OBJECT_ID, { type: "address", value: address }],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.result.error) {
      throw new Error(
        "Please make the first claim at your Wave Wallet Bot or refill your SUI balance."
      );
    }

    const lastClaimTime = parseInt(
      response.data.result.data.content.fields.last_claim
    );
    const nextClaimTime = new Date(lastClaimTime + 7200000);
    const timeLeft = nextClaimTime - new Date();
    return timeLeft;
  } catch (error) {
    throw error;
  }
};

// Logging function with timestamp
const log = (message) => {
  console.log(`[${moment().format("DD/MM/YY HH:mm:ss")}] ${message}`);
};

// Convert milliseconds to human-readable time format
const convertTime = (ms) => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hours} Hour(s), ${minutes} minute(s), ${seconds} second(s)`;
};

// Main execution loop
(async () => {
  while (true) {
    let minTimeLeft = Number.MAX_SAFE_INTEGER;
    let selectedAddress = "";

    for (const mnemonic of SUI_MNEMONIC_ARRAY) {
      try {
        const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
        const address = keypair.getPublicKey().toSuiAddress();
        const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

        const suiBalance =
          (await client.getBalance({ owner: address })).totalBalance /
          1000000000;
        const oceanBalance =
          (
            await client.getBalance({
              owner: address,
              coinType: `${OCEAN_PACKAGE_ID}::ocean::OCEAN`,
            })
          ).totalBalance / 1000000000;

        log(`Address: ${address}`);
        log(`Mnemonic: ${mnemonic}`);
        log(`SUI Balance: ${chalk.blueBright(suiBalance)} SUI`);
        log(`OCEAN Balance: ${chalk.blueBright(oceanBalance)} OCEAN`);

        await delay(5000);

        const timeLeft = await getTimeLeft(address);
        if (timeLeft > 0) {
          log(
            chalk.yellowBright(`Remain Time: ${await convertTime(timeLeft)}\n`)
          );
          if (timeLeft < minTimeLeft) {
            minTimeLeft = timeLeft;
            selectedAddress = address;
          }
          continue;
        }

        const { bytes, signature } = await makeClaimTx(
          client,
          keypair,
          address
        );
        const result = await sendTransaction(client, bytes, signature);

        if (result.effects.status.status === "failure") {
          log(chalk.redBright("Status: Failed to claim\n"));
          continue;
        }

        log(chalk.greenBright("Status: Claim success\n"));
      } catch (error) {
        log(chalk.redBright(`Status: ${error.message}\n`));
        continue;
      }
    }

    const waitTime =
      minTimeLeft < parseInt(1) || minTimeLeft === Number.MAX_SAFE_INTEGER
        ? parseInt(60000)
        : minTimeLeft;
    log(
      chalk.cyanBright(`==== Wait Until ${await convertTime(waitTime)} ====`)
    );
    await delay(waitTime);
  }
})();
