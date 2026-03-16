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
import {
  PROTOCOL_ADDRESS,
  THRYX_ADDRESS,
  WETH_ADDRESS,
} from "../constants.js";

const examples: ActionExample[][] = [
  [
    {
      name: "user",
      content: {
        text: "Buy 0.01 ETH worth of 0x1234567890abcdef1234567890abcdef12345678",
      },
    },
    {
      name: "agent",
      content: {
        text: "Buying tokens with 0.01 ETH on ThryxProtocol...\n\nPurchase complete!\nReceived: 1,234,567 TOKENS\nTx: 0xabcd...1234",
        actions: ["THRYX_BUY"],
      },
    },
  ],
  [
    {
      name: "user",
      content: {
        text: "Buy 100 THRYX worth of token 0xabcdef1234567890abcdef1234567890abcdef12",
      },
    },
    {
      name: "agent",
      content: {
        text: "Buying tokens with 100 THRYX on ThryxProtocol...\n\nPurchase complete!\nReceived: 5,000,000 TOKENS\nSpent: 100 THRYX\nTx: 0x5678...efgh",
        actions: ["THRYX_BUY"],
      },
    },
  ],
];

export const buyAction: Action = {
  name: "THRYX_BUY",
  description:
    "Buy tokens on ThryxProtocol using ETH or THRYX. Specify the token address and amount to spend. Applies 10% slippage protection.",
  similes: [
    "BUY_TOKEN",
    "PURCHASE_TOKEN",
    "THRYX_PURCHASE",
    "BUY_THRYX_TOKEN",
    "SWAP_FOR_TOKEN",
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

    // Parse: token address, amount, and asset (eth or thryx)
    // Patterns:
    //   "Buy 0.01 ETH worth of 0x..."
    //   "Buy 0x... with 0.01 ETH"
    //   "Buy 100 THRYX worth of 0x..."
    //   "Purchase 0x... for 0.5 eth"
    let tokenAddress: string | null = null;
    let amount: string | null = null;
    let asset: "eth" | "thryx" = "eth";

    // Extract token address (0x followed by 40 hex chars)
    const addrMatch = text.match(/0x[a-fA-F0-9]{40}/);
    if (addrMatch) {
      tokenAddress = addrMatch[0];
    }

    // Extract amount and asset
    const amountMatch = text.match(
      /(\d+(?:\.\d+)?)\s*(eth|thryx|weth)/i
    );
    if (amountMatch) {
      amount = amountMatch[1];
      const rawAsset = amountMatch[2].toLowerCase();
      asset = rawAsset === "thryx" ? "thryx" : "eth";
    }

    // Fallback: just look for a number if no asset specified
    if (!amount) {
      const numMatch = text.match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        amount = numMatch[1];
      }
    }

    if (!tokenAddress || !isValidAddress(tokenAddress)) {
      if (callback) {
        await callback({
          text: "I need a valid token address to buy. Try:\n- \"Buy 0.01 ETH worth of 0x1234...abcd\"\n- \"Buy 100 THRYX worth of 0x1234...abcd\"",
        });
      }
      return { success: false, error: "No valid token address found" };
    }

    if (!amount || parseFloat(amount) <= 0) {
      if (callback) {
        await callback({
          text: "I need an amount to spend. Try:\n- \"Buy 0.01 ETH worth of 0x1234...abcd\"\n- \"Buy 100 THRYX worth of 0x1234...abcd\"",
        });
      }
      return { success: false, error: "No valid amount found" };
    }

    try {
      const wallet = getWallet(runtime);
      const protocol = getProtocol(wallet);
      const amountIn = ethers.parseEther(amount);

      const tokenIn = asset === "eth" ? WETH_ADDRESS : THRYX_ADDRESS;
      const tokenOut = tokenAddress;

      // Get estimate for slippage calculation
      const estimated = await protocol.estimateSwap(
        tokenIn,
        tokenOut,
        amountIn
      );
      const minOut = applySlippage(estimated);

      if (callback) {
        await callback({
          text: `Buying ${shortAddress(tokenAddress)} with ${amount} ${asset.toUpperCase()} on ThryxProtocol...\n\nEstimated output: ${formatTokenAmount(estimated)} tokens\nMin output (10% slippage): ${formatTokenAmount(minOut)} tokens`,
        });
      }

      let tx;
      if (asset === "eth") {
        // ETH buy: send value with the swap call
        tx = await protocol.swap(tokenIn, tokenOut, amountIn, minOut, {
          value: amountIn,
        });
      } else {
        // THRYX buy: approve first if needed
        const thryx = getERC20(THRYX_ADDRESS, wallet);
        const currentAllowance = await thryx.allowance(
          wallet.address,
          PROTOCOL_ADDRESS
        );
        if (currentAllowance < amountIn) {
          const approveTx = await thryx.approve(
            PROTOCOL_ADDRESS,
            ethers.MaxUint256
          );
          await approveTx.wait();
        }
        tx = await protocol.swap(tokenIn, tokenOut, amountIn, minOut);
      }

      const receipt = await tx.wait();

      const result = {
        success: true,
        token: tokenAddress,
        amountSpent: amount,
        asset: asset.toUpperCase(),
        estimatedReceived: formatTokenAmount(estimated),
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };

      if (callback) {
        await callback({
          text: `Purchase complete!\n\nSpent: ${amount} ${asset.toUpperCase()}\nEstimated received: ${formatTokenAmount(estimated)} tokens\nTx: \`${shortHash(receipt.hash)}\`\nView: https://basescan.org/tx/${receipt.hash}`,
        });
      }

      return result;
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : String(error);

      if (callback) {
        await callback({
          text: `Failed to buy token: ${errMsg}`,
        });
      }
      return { success: false, error: errMsg };
    }
  },
};
