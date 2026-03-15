import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ActionExample,
} from "@elizaos/core";
import { getWallet, getProtocol, shortAddress, shortHash } from "../utils.js";
import { PROTOCOL_ADDRESS } from "../constants.js";

const examples: ActionExample[][] = [
  [
    {
      name: "user",
      content: {
        text: "Launch a token called Degen Cats with symbol DCAT",
      },
    },
    {
      name: "agent",
      content: {
        text: "Launching Degen Cats (DCAT) on ThryxProtocol...\n\nToken deployed!\nAddress: 0x1234...abcd\nTx: 0xabcd...1234\n\nYour token is now live on the bonding curve. Share it and let people trade!",
        actions: ["THRYX_LAUNCH"],
      },
    },
  ],
  [
    {
      name: "user",
      content: {
        text: "Create a new token named Based AI Agent with ticker BAIA",
      },
    },
    {
      name: "agent",
      content: {
        text: "Deploying Based AI Agent (BAIA) on ThryxProtocol...\n\nToken launched successfully!\nAddress: 0x5678...efgh\nTx: 0xefgh...5678\n\nThe token is live on a bonding curve. Cost: ~$0.01 gas.",
        actions: ["THRYX_LAUNCH"],
      },
    },
  ],
];

export const launchAction: Action = {
  name: "THRYX_LAUNCH",
  description:
    "Launch a new token on ThryxProtocol (Base mainnet). Creates a bonding curve token with the given name and symbol. Costs only gas (~$0.01 on Base).",
  similes: [
    "LAUNCH_TOKEN",
    "CREATE_TOKEN",
    "DEPLOY_TOKEN",
    "THRYX_DEPLOY",
    "MINT_TOKEN",
    "LAUNCH_THRYX_TOKEN",
    "CREATE_THRYX_TOKEN",
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

    // Parse name and symbol from message
    // Common patterns:
    //   "Launch Degen Cats with symbol DCAT"
    //   "Create a token called Degen Cats DCAT"
    //   "Deploy Degen Cats (DCAT)"
    //   "Launch token: Degen Cats, symbol: DCAT"
    let name: string | null = null;
    let symbol: string | null = null;

    // Try pattern: name (SYMBOL) or name [SYMBOL]
    const parenMatch = text.match(
      /(?:launch|create|deploy|mint)\s+(?:a\s+)?(?:new\s+)?(?:token\s+)?(?:called\s+|named\s+)?["']?(.+?)["']?\s*[\(\[]\s*([A-Z0-9]{2,10})\s*[\)\]]/i
    );
    if (parenMatch) {
      name = parenMatch[1].trim();
      symbol = parenMatch[2].toUpperCase();
    }

    // Try pattern: name with symbol SYMBOL / name with ticker SYMBOL
    if (!symbol) {
      const withMatch = text.match(
        /(?:launch|create|deploy|mint)\s+(?:a\s+)?(?:new\s+)?(?:token\s+)?(?:called\s+|named\s+)?["']?(.+?)["']?\s+(?:with\s+)?(?:symbol|ticker)\s+["']?([A-Z0-9]{2,10})["']?/i
      );
      if (withMatch) {
        name = withMatch[1].trim();
        symbol = withMatch[2].toUpperCase();
      }
    }

    // Try pattern: "name" "SYMBOL" or name SYMBOL at end
    if (!symbol) {
      const simpleMatch = text.match(
        /(?:launch|create|deploy|mint)\s+(?:a\s+)?(?:new\s+)?(?:token\s+)?(?:called\s+|named\s+)?["']?(.+?)\s+([A-Z][A-Z0-9]{1,9})["']?\s*$/i
      );
      if (simpleMatch) {
        name = simpleMatch[1].trim();
        symbol = simpleMatch[2].toUpperCase();
      }
    }

    // Try pattern: symbol: X, name: Y
    if (!symbol) {
      const colonMatch = text.match(/name[:\s]+["']?(.+?)["']?\s*[,;]\s*symbol[:\s]+["']?([A-Z0-9]{2,10})["']?/i);
      if (colonMatch) {
        name = colonMatch[1].trim();
        symbol = colonMatch[2].toUpperCase();
      }
    }
    if (!symbol) {
      const colonMatch2 = text.match(/symbol[:\s]+["']?([A-Z0-9]{2,10})["']?\s*[,;]\s*name[:\s]+["']?(.+?)["']?$/i);
      if (colonMatch2) {
        symbol = colonMatch2[1].toUpperCase();
        name = colonMatch2[2].trim();
      }
    }

    if (!name || !symbol) {
      if (callback) {
        await callback({
          text: "I need both a token name and symbol to launch. Try something like:\n- \"Launch Degen Cats with symbol DCAT\"\n- \"Create a token called Based AI (BAIA)\"",
        });
      }
      return { success: false, error: "Could not parse token name and symbol from message" };
    }

    // Clean up name (remove trailing prepositions/articles that got captured)
    name = name.replace(/\s+(with|and|the|a|an)\s*$/i, "").trim();

    try {
      const wallet = getWallet(runtime);
      const protocol = getProtocol(wallet);

      if (callback) {
        await callback({
          text: `Launching **${name}** (${symbol}) on ThryxProtocol...\n\nDeployer: ${shortAddress(wallet.address)}`,
        });
      }

      const tx = await protocol.launch(name, symbol);
      const receipt = await tx.wait();

      // Extract token address from logs
      // The Launch event emits the token address
      let tokenAddress = "";
      if (receipt.logs && receipt.logs.length > 0) {
        // The first log from the protocol contract typically contains the token address
        // Look for a log with a topic that matches the Launch event
        for (const log of receipt.logs) {
          try {
            const parsed = protocol.interface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
            if (parsed && parsed.name === "TokenLaunched") {
              tokenAddress = parsed.args[0] || parsed.args.token;
              break;
            }
          } catch {
            // Not a protocol log, skip
          }
        }

        // Fallback: check for Transfer events (token creation) from a new contract
        if (!tokenAddress) {
          for (const log of receipt.logs) {
            // ERC20 Transfer from zero address = mint
            if (
              log.topics[0] ===
              "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
            ) {
              // The contract that emitted this Transfer is likely the new token
              if (log.address && log.address.toLowerCase() !== PROTOCOL_ADDRESS.toLowerCase()) {
                tokenAddress = log.address;
                break;
              }
            }
          }
        }
      }

      const result = {
        success: true,
        name,
        symbol,
        tokenAddress: tokenAddress || "Check tx receipt for token address",
        txHash: receipt.hash,
        deployer: wallet.address,
        gasUsed: receipt.gasUsed.toString(),
      };

      if (callback) {
        await callback({
          text: `Token launched successfully!\n\n**${name}** (${symbol})\nAddress: \`${tokenAddress || "see tx"}\`\nTx: \`${shortHash(receipt.hash)}\`\nGas used: ${receipt.gasUsed.toString()}\n\nThe token is live on a bonding curve. Anyone can buy and sell it now.\nView on Basescan: https://basescan.org/tx/${receipt.hash}`,
        });
      }

      return result;
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : String(error);

      if (callback) {
        await callback({
          text: `Failed to launch token: ${errMsg}`,
        });
      }
      return { success: false, error: errMsg };
    }
  },
};
