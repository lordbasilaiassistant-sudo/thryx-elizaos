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
  signMetaLaunch,
  submitMetaLaunch,
} from "../utils.js";
import { PROTOCOL_ADDRESS, RELAY_URL } from "../constants.js";

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
        text: "Launching Degen Cats (DCAT) gaslessly via ThryxProtocol relay...\n\nToken deployed!\nAddress: 0x1234...abcd\nTx: 0xabcd...1234\n\nYour token is now live on the bonding curve. No gas was spent!",
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
        text: "Deploying Based AI Agent (BAIA) gaslessly via ThryxProtocol relay...\n\nToken launched successfully!\nAddress: 0x5678...efgh\nTx: 0xefgh...5678\n\nThe token is live on a bonding curve. Zero gas cost — the relay paid for you!",
        actions: ["THRYX_LAUNCH"],
      },
    },
  ],
];

/** Shared return type for gasless and direct launch attempts. */
interface LaunchResult {
  success: boolean;
  tokenAddress?: string;
  txHash?: string;
  deployer?: string;
  gasUsed?: string;
  method?: string;
  error?: string;
}

/**
 * Parse token name and symbol from user message text.
 * Handles many natural language patterns.
 */
function parseNameAndSymbol(text: string): { name: string; symbol: string } | null {
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
    const colonMatch = text.match(
      /name[:\s]+["']?(.+?)["']?\s*[,;]\s*symbol[:\s]+["']?([A-Z0-9]{2,10})["']?/i
    );
    if (colonMatch) {
      name = colonMatch[1].trim();
      symbol = colonMatch[2].toUpperCase();
    }
  }
  if (!symbol) {
    const colonMatch2 = text.match(
      /symbol[:\s]+["']?([A-Z0-9]{2,10})["']?\s*[,;]\s*name[:\s]+["']?(.+?)["']?$/i
    );
    if (colonMatch2) {
      symbol = colonMatch2[1].toUpperCase();
      name = colonMatch2[2].trim();
    }
  }

  if (!name || !symbol) return null;

  // Clean up name (remove trailing prepositions/articles that got captured)
  name = name.replace(/\s+(with|and|the|a|an)\s*$/i, "").trim();

  return { name, symbol };
}

/**
 * Extract a token address from transaction receipt logs.
 */
function extractTokenFromReceipt(
  receipt: { logs: Array<{ topics: string[]; data: string; address: string }> },
  protocolInterface: { parseLog(log: { topics: string[]; data: string }): { name: string; args: Record<string, string> } | null }
): string {
  // Look for TokenLaunched event from the protocol
  for (const log of receipt.logs) {
    try {
      const parsed = protocolInterface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed && parsed.name === "TokenLaunched") {
        return parsed.args[0] || parsed.args.token || "";
      }
    } catch {
      // Not a protocol log, skip
    }
  }

  // Fallback: check for Transfer events (token creation) from a new contract
  for (const log of receipt.logs) {
    // ERC20 Transfer from zero address = mint
    if (
      log.topics[0] ===
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    ) {
      if (log.address && log.address.toLowerCase() !== PROTOCOL_ADDRESS.toLowerCase()) {
        return log.address;
      }
    }
  }

  return "";
}

/**
 * Attempt gasless launch via the Cloudflare relay (metaLaunch).
 * Signs EIP-712 typed data off-chain, submits to relay — zero gas cost.
 */
async function launchGasless(
  runtime: IAgentRuntime,
  name: string,
  symbol: string,
  callback?: HandlerCallback
): Promise<LaunchResult> {
  const wallet = getWallet(runtime);

  if (callback) {
    await callback({
      text: `Launching **${name}** (${symbol}) gaslessly via ThryxProtocol relay...\n\nSigner: ${shortAddress(wallet.address)}\nRelay: ${RELAY_URL}`,
    });
  }

  // Sign EIP-712 typed data (5 minute deadline)
  const signed = await signMetaLaunch(wallet, name, symbol, 300);

  // Submit to relay
  const result = await submitMetaLaunch({
    name: signed.name,
    symbol: signed.symbol,
    user: signed.user,
    deadline: signed.deadline,
    v: signed.v,
    r: signed.r,
    s: signed.s,
  });

  if (!result.success) {
    return {
      success: false,
      deployer: wallet.address,
      method: "gasless",
      error: result.error || "Relay rejected the request",
    };
  }

  return {
    success: true,
    tokenAddress: result.token || "",
    txHash: result.txHash || "",
    deployer: wallet.address,
    method: "gasless",
  };
}

/**
 * Attempt direct on-chain launch (requires gas).
 * Used as fallback when the gasless relay is unavailable.
 */
async function launchDirect(
  runtime: IAgentRuntime,
  name: string,
  symbol: string,
  callback?: HandlerCallback
): Promise<LaunchResult> {
  const wallet = getWallet(runtime);
  const protocol = getProtocol(wallet);

  if (callback) {
    await callback({
      text: `Gasless relay unavailable. Launching **${name}** (${symbol}) directly on-chain...\n\nDeployer: ${shortAddress(wallet.address)}\nNote: This will cost gas (~$0.01 on Base).`,
    });
  }

  const tx = await protocol.launch(name, symbol);
  const receipt = await tx.wait();

  const tokenAddress = extractTokenFromReceipt(
    receipt,
    protocol.interface as unknown as {
      parseLog(log: { topics: string[]; data: string }): { name: string; args: Record<string, string> } | null;
    }
  );

  return {
    success: true,
    tokenAddress,
    txHash: receipt.hash,
    deployer: wallet.address,
    gasUsed: receipt.gasUsed.toString(),
    method: "direct",
  };
}

export const launchAction: Action = {
  name: "THRYX_LAUNCH",
  description:
    "Launch a new token on ThryxProtocol (Base mainnet). Uses gasless metaLaunch by default (zero gas cost via relay). Falls back to direct on-chain launch if the relay is unavailable.",
  similes: [
    "LAUNCH_TOKEN",
    "CREATE_TOKEN",
    "DEPLOY_TOKEN",
    "THRYX_DEPLOY",
    "MINT_TOKEN",
    "LAUNCH_THRYX_TOKEN",
    "CREATE_THRYX_TOKEN",
    "GASLESS_LAUNCH",
    "META_LAUNCH",
    "FREE_LAUNCH",
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

    const parsed = parseNameAndSymbol(text);
    if (!parsed) {
      if (callback) {
        await callback({
          text: 'I need both a token name and symbol to launch. Try something like:\n- "Launch Degen Cats with symbol DCAT"\n- "Create a token called Based AI (BAIA)"',
        });
      }
      return {
        success: false,
        error: "Could not parse token name and symbol from message",
      };
    }

    const { name, symbol } = parsed;

    try {
      // Default: gasless metaLaunch via relay
      let result = await launchGasless(runtime, name, symbol, callback);

      // Fallback: direct on-chain launch if relay failed
      if (!result.success) {
        const relayError = result.error;
        try {
          result = await launchDirect(runtime, name, symbol, callback);
        } catch (directErr: unknown) {
          // Both methods failed — report both errors
          const directMsg =
            directErr instanceof Error ? directErr.message : String(directErr);
          if (callback) {
            await callback({
              text: `Failed to launch token.\n\nGasless relay error: ${relayError}\nDirect launch error: ${directMsg}`,
            });
          }
          return {
            success: false,
            error: `Gasless: ${relayError} | Direct: ${directMsg}`,
          };
        }
      }

      const output = {
        success: true,
        name,
        symbol,
        tokenAddress: result.tokenAddress || "Check tx receipt for token address",
        txHash: result.txHash || "",
        deployer: result.deployer || "",
        method: result.method || "gasless",
        gasUsed: result.gasUsed || "0 (gasless)",
      };

      if (callback) {
        const methodLabel =
          result.method === "gasless"
            ? "Gasless (zero gas cost)"
            : `Direct (gas used: ${result.gasUsed})`;

        await callback({
          text: [
            "Token launched successfully!",
            "",
            `**${name}** (${symbol})`,
            `Address: \`${result.tokenAddress || "see tx"}\``,
            `Tx: \`${result.txHash ? shortHash(result.txHash) : "pending"}\``,
            `Method: ${methodLabel}`,
            "",
            "The token is live on a bonding curve. Anyone can buy and sell it now.",
            result.txHash
              ? `View on Basescan: https://basescan.org/tx/${result.txHash}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        });
      }

      return output;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);

      if (callback) {
        await callback({
          text: `Failed to launch token: ${errMsg}`,
        });
      }
      return { success: false, error: errMsg };
    }
  },
};
