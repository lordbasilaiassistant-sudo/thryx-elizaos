import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ActionExample,
} from "@elizaos/core";
import {
  getWallet,
  getProtocol,
  shortAddress,
  shortHash,
  isValidAddress,
  formatTokenAmount,
} from "../utils.js";

const examples: ActionExample[][] = [
  [
    {
      name: "user",
      content: {
        text: "Claim creator fees for 0x1234567890abcdef1234567890abcdef12345678",
      },
    },
    {
      name: "agent",
      content: {
        text: "Claiming creator fees for 0x1234...5678...\n\nClaimed 12.5 THRYX in creator fees!\nTx: 0xabcd...1234",
        actions: ["THRYX_CLAIM"],
      },
    },
  ],
];

export const claimAction: Action = {
  name: "THRYX_CLAIM",
  description:
    "Claim accumulated creator fees (in THRYX) for a token you deployed on ThryxProtocol. You must be the token's deployer.",
  similes: [
    "CLAIM_FEES",
    "THRYX_CLAIM_FEES",
    "COLLECT_FEES",
    "CLAIM_CREATOR_FEES",
    "CLAIM_THRYX_FEES",
    "WITHDRAW_FEES",
  ],
  examples,

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory
  ): Promise<boolean> => {
    const key =
      runtime.getSetting("THRYX_PRIVATE_KEY") ||
      runtime.getSetting("EVM_PRIVATE_KEY");
    return !!key;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) => {
    const text = (message.content.text as string) || "";

    // Extract token address
    const addrMatch = text.match(/0x[a-fA-F0-9]{40}/);
    const tokenAddress = addrMatch ? addrMatch[0] : null;

    if (!tokenAddress || !isValidAddress(tokenAddress)) {
      if (callback) {
        await callback({
          text: "I need a valid token address to claim fees for. Try:\n- \"Claim fees for 0x1234...abcd\"",
        });
      }
      return { success: false, error: "No valid token address found" };
    }

    try {
      const wallet = getWallet(runtime);
      const protocol = getProtocol(wallet);

      // Check if there are fees to claim by reading curve info
      const curveInfo = await protocol.getCurveInfo(tokenAddress);
      const creatorFees = curveInfo[9]; // index 9 = creatorFees

      if (creatorFees === 0n) {
        if (callback) {
          await callback({
            text: `No creator fees to claim for ${shortAddress(tokenAddress)}.`,
          });
        }
        return { success: true, claimed: "0", token: tokenAddress };
      }

      if (callback) {
        await callback({
          text: `Claiming ${formatTokenAmount(creatorFees)} THRYX in creator fees for ${shortAddress(tokenAddress)}...`,
        });
      }

      const tx = await protocol.claimCreatorFees(tokenAddress);
      const receipt = await tx.wait();

      const result = {
        success: true,
        token: tokenAddress,
        claimed: formatTokenAmount(creatorFees),
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };

      if (callback) {
        await callback({
          text: `Claimed ${formatTokenAmount(creatorFees)} THRYX in creator fees!\n\nToken: ${shortAddress(tokenAddress)}\nTx: \`${shortHash(receipt.hash)}\`\nView: https://basescan.org/tx/${receipt.hash}`,
        });
      }

      return result;
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : String(error);

      if (callback) {
        await callback({
          text: `Failed to claim fees: ${errMsg}`,
        });
      }
      return { success: false, error: errMsg };
    }
  },
};
