import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ActionExample,
} from "@elizaos/core";
import { ethers } from "ethers";
import {
  getWallet,
  getProtocol,
  getERC20,
  applySlippage,
  shortAddress,
  shortHash,
  isValidAddress,
  formatTokenAmount,
} from "../utils.js";
import { PROTOCOL_ADDRESS, THRYX_ADDRESS } from "../constants.js";

const examples: ActionExample[][] = [
  [
    {
      name: "user",
      content: {
        text: "Sell all of 0x1234567890abcdef1234567890abcdef12345678",
      },
    },
    {
      name: "agent",
      content: {
        text: "Selling all tokens for THRYX on ThryxProtocol...\n\nSale complete!\nSold: 1,000,000 TOKENS\nReceived: 50.5 THRYX\nTx: 0xabcd...1234",
        actions: ["THRYX_SELL"],
      },
    },
  ],
  [
    {
      name: "user",
      content: {
        text: "Sell 500000 of token 0xabcdef1234567890abcdef1234567890abcdef12",
      },
    },
    {
      name: "agent",
      content: {
        text: "Selling 500,000 tokens for THRYX on ThryxProtocol...\n\nSale complete!\nSold: 500,000 TOKENS\nReceived: 25.2 THRYX\nTx: 0x5678...efgh",
        actions: ["THRYX_SELL"],
      },
    },
  ],
];

export const sellAction: Action = {
  name: "THRYX_SELL",
  description:
    "Sell tokens on ThryxProtocol for THRYX. Specify the token address and amount (or 'all' to sell entire balance). Applies 10% slippage protection.",
  similes: [
    "SELL_TOKEN",
    "DUMP_TOKEN",
    "THRYX_DUMP",
    "SELL_THRYX_TOKEN",
    "SWAP_TOKEN",
  ],
  examples,

  validate: async (
    runtime: IAgentRuntime,
    _message: Memory
  ): Promise<boolean> => {
    const key =
      runtime.getSetting("PRIVATE_KEY") ||
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

    // Parse: token address and amount (number or "all")
    let tokenAddress: string | null = null;
    let amount: string | null = null;
    let sellAll = false;

    // Extract token address
    const addrMatch = text.match(/0x[a-fA-F0-9]{40}/);
    if (addrMatch) {
      tokenAddress = addrMatch[0];
    }

    // Check for "all"
    if (/\ball\b/i.test(text)) {
      sellAll = true;
    }

    // Extract numeric amount if not selling all
    if (!sellAll) {
      const numMatch = text.match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        amount = numMatch[1];
      }
    }

    if (!tokenAddress || !isValidAddress(tokenAddress)) {
      if (callback) {
        await callback({
          text: "I need a valid token address to sell. Try:\n- \"Sell all of 0x1234...abcd\"\n- \"Sell 500000 of 0x1234...abcd\"",
        });
      }
      return { success: false, error: "No valid token address found" };
    }

    // Prevent selling THRYX
    if (tokenAddress.toLowerCase() === THRYX_ADDRESS.toLowerCase()) {
      if (callback) {
        await callback({
          text: "Cannot sell THRYX -- it is the core ecosystem token and is protected.",
        });
      }
      return { success: false, error: "THRYX is a protected token and cannot be sold" };
    }

    try {
      const wallet = getWallet(runtime);
      const protocol = getProtocol(wallet);
      const token = getERC20(tokenAddress, wallet);

      // Determine amount to sell
      let amountIn: bigint;
      if (sellAll) {
        amountIn = await token.balanceOf(wallet.address);
        if (amountIn === 0n) {
          if (callback) {
            await callback({
              text: `You don't hold any tokens at ${shortAddress(tokenAddress)}.`,
            });
          }
          return { success: false, error: "Zero balance" };
        }
      } else if (amount) {
        // Try to get decimals, default to 18
        let decimals = 18;
        try {
          decimals = Number(await token.decimals());
        } catch {
          // default 18
        }
        amountIn = ethers.parseUnits(amount, decimals);
      } else {
        if (callback) {
          await callback({
            text: "I need an amount to sell (or say 'all'). Try:\n- \"Sell all of 0x1234...abcd\"\n- \"Sell 500000 of 0x1234...abcd\"",
          });
        }
        return { success: false, error: "No amount specified" };
      }

      const tokenIn = tokenAddress;
      const tokenOut = THRYX_ADDRESS;

      // Get estimate for slippage calculation
      const estimated = await protocol.estimateSwap(
        tokenIn,
        tokenOut,
        amountIn
      );
      const minOut = applySlippage(estimated);

      if (callback) {
        await callback({
          text: `Selling ${sellAll ? "all" : amount} tokens of ${shortAddress(tokenAddress)} for THRYX...\n\nAmount: ${formatTokenAmount(amountIn)} tokens\nEstimated THRYX out: ${formatTokenAmount(estimated)}\nMin out (10% slippage): ${formatTokenAmount(minOut)}`,
        });
      }

      // Approve if needed
      const currentAllowance = await token.allowance(
        wallet.address,
        PROTOCOL_ADDRESS
      );
      if (currentAllowance < amountIn) {
        const approveTx = await token.approve(
          PROTOCOL_ADDRESS,
          ethers.MaxUint256
        );
        await approveTx.wait();
      }

      const tx = await protocol.swap(tokenIn, tokenOut, amountIn, minOut);
      const receipt = await tx.wait();

      const result = {
        success: true,
        token: tokenAddress,
        amountSold: formatTokenAmount(amountIn),
        estimatedThryx: formatTokenAmount(estimated),
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };

      if (callback) {
        await callback({
          text: `Sale complete!\n\nSold: ${formatTokenAmount(amountIn)} tokens\nEstimated received: ${formatTokenAmount(estimated)} THRYX\nTx: \`${shortHash(receipt.hash)}\`\nView: https://basescan.org/tx/${receipt.hash}`,
        });
      }

      return result;
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : String(error);

      if (callback) {
        await callback({
          text: `Failed to sell token: ${errMsg}`,
        });
      }
      return { success: false, error: errMsg };
    }
  },
};
