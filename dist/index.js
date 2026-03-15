// src/utils.ts
import { ethers } from "ethers";

// src/constants.ts
var CHAIN_ID = 8453;
var RPC_URL = "https://mainnet.base.org";
var PROTOCOL_ADDRESS = "0x2F77b40c124645d25782CfBdfB1f54C1d76f2cCe";
var THRYX_ADDRESS = "0xc07E889e1816De2708BF718683e52150C20F3BA3";
var WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
var PROTOCOL_ABI = [
  "function launch(string name, string symbol) external returns (address)",
  "function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut) external payable returns (uint256)",
  "function estimateSwap(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256)",
  "function getCurveInfo(address token) external view returns (address deployer, uint256 spotPrice, uint256 raised, uint256 threshold, uint256 progressBps, uint256 tokensSold, uint256 tokensAvailable, bool graduated, address aeroPool, uint256 creatorFees, uint256 protocolFees)",
  "function getProtocolStats() external view returns (uint256 launched, uint256 graduated, uint256 lifetimeFees, uint256 thryxReserves, uint256 ethReserves, uint256 ethRate)",
  "function claimCreatorFees(address token) external returns (uint256)"
];
var ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];
var DEFAULT_SLIPPAGE_BPS = 1e3;

// src/utils.ts
function getPrivateKey(runtime) {
  const key = runtime.getSetting("THRYX_PRIVATE_KEY") || runtime.getSetting("EVM_PRIVATE_KEY");
  if (!key || typeof key !== "string") {
    throw new Error(
      "No private key configured. Set THRYX_PRIVATE_KEY or EVM_PRIVATE_KEY in your agent settings."
    );
  }
  return key;
}
function getProvider() {
  return new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, {
    staticNetwork: true
  });
}
function getWallet(runtime) {
  const key = getPrivateKey(runtime);
  const provider = getProvider();
  return new ethers.Wallet(key, provider);
}
function getProtocol(signer) {
  return new ethers.Contract(PROTOCOL_ADDRESS, PROTOCOL_ABI, signer);
}
function getERC20(address, signerOrProvider) {
  return new ethers.Contract(address, ERC20_ABI, signerOrProvider);
}
function applySlippage(amount, slippageBps = DEFAULT_SLIPPAGE_BPS) {
  return amount * BigInt(1e4 - slippageBps) / BigInt(1e4);
}
function formatTokenAmount(amount, decimals = 18) {
  return ethers.formatUnits(amount, decimals);
}
function parseTokenAmount(amount, decimals = 18) {
  return ethers.parseUnits(amount, decimals);
}
function isValidAddress(address) {
  try {
    ethers.getAddress(address);
    return true;
  } catch {
    return false;
  }
}
function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
function shortHash(hash) {
  return `${hash.slice(0, 10)}...${hash.slice(-4)}`;
}

// src/actions/launch.ts
var examples = [
  [
    {
      name: "user",
      content: {
        text: "Launch a token called Degen Cats with symbol DCAT"
      }
    },
    {
      name: "agent",
      content: {
        text: "Launching Degen Cats (DCAT) on ThryxProtocol...\n\nToken deployed!\nAddress: 0x1234...abcd\nTx: 0xabcd...1234\n\nYour token is now live on the bonding curve. Share it and let people trade!",
        actions: ["THRYX_LAUNCH"]
      }
    }
  ],
  [
    {
      name: "user",
      content: {
        text: "Create a new token named Based AI Agent with ticker BAIA"
      }
    },
    {
      name: "agent",
      content: {
        text: "Deploying Based AI Agent (BAIA) on ThryxProtocol...\n\nToken launched successfully!\nAddress: 0x5678...efgh\nTx: 0xefgh...5678\n\nThe token is live on a bonding curve. Cost: ~$0.01 gas.",
        actions: ["THRYX_LAUNCH"]
      }
    }
  ]
];
var launchAction = {
  name: "THRYX_LAUNCH",
  description: "Launch a new token on ThryxProtocol (Base mainnet). Creates a bonding curve token with the given name and symbol. Costs only gas (~$0.01 on Base).",
  similes: [
    "LAUNCH_TOKEN",
    "CREATE_TOKEN",
    "DEPLOY_TOKEN",
    "THRYX_DEPLOY",
    "MINT_TOKEN",
    "LAUNCH_THRYX_TOKEN",
    "CREATE_THRYX_TOKEN"
  ],
  examples,
  validate: async (runtime, _message) => {
    const key = runtime.getSetting("THRYX_PRIVATE_KEY") || runtime.getSetting("EVM_PRIVATE_KEY");
    return !!key;
  },
  handler: async (runtime, message, _state, _options, callback) => {
    const text = message.content.text || "";
    let name = null;
    let symbol = null;
    const parenMatch = text.match(
      /(?:launch|create|deploy|mint)\s+(?:a\s+)?(?:new\s+)?(?:token\s+)?(?:called\s+|named\s+)?["']?(.+?)["']?\s*[\(\[]\s*([A-Z0-9]{2,10})\s*[\)\]]/i
    );
    if (parenMatch) {
      name = parenMatch[1].trim();
      symbol = parenMatch[2].toUpperCase();
    }
    if (!symbol) {
      const withMatch = text.match(
        /(?:launch|create|deploy|mint)\s+(?:a\s+)?(?:new\s+)?(?:token\s+)?(?:called\s+|named\s+)?["']?(.+?)["']?\s+(?:with\s+)?(?:symbol|ticker)\s+["']?([A-Z0-9]{2,10})["']?/i
      );
      if (withMatch) {
        name = withMatch[1].trim();
        symbol = withMatch[2].toUpperCase();
      }
    }
    if (!symbol) {
      const simpleMatch = text.match(
        /(?:launch|create|deploy|mint)\s+(?:a\s+)?(?:new\s+)?(?:token\s+)?(?:called\s+|named\s+)?["']?(.+?)\s+([A-Z][A-Z0-9]{1,9})["']?\s*$/i
      );
      if (simpleMatch) {
        name = simpleMatch[1].trim();
        symbol = simpleMatch[2].toUpperCase();
      }
    }
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
          text: 'I need both a token name and symbol to launch. Try something like:\n- "Launch Degen Cats with symbol DCAT"\n- "Create a token called Based AI (BAIA)"'
        });
      }
      return { success: false, error: "Could not parse token name and symbol from message" };
    }
    name = name.replace(/\s+(with|and|the|a|an)\s*$/i, "").trim();
    try {
      const wallet = getWallet(runtime);
      const protocol = getProtocol(wallet);
      if (callback) {
        await callback({
          text: `Launching **${name}** (${symbol}) on ThryxProtocol...

Deployer: ${shortAddress(wallet.address)}`
        });
      }
      const tx = await protocol.launch(name, symbol);
      const receipt = await tx.wait();
      let tokenAddress = "";
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          try {
            const parsed = protocol.interface.parseLog({
              topics: log.topics,
              data: log.data
            });
            if (parsed && parsed.name === "TokenLaunched") {
              tokenAddress = parsed.args[0] || parsed.args.token;
              break;
            }
          } catch {
          }
        }
        if (!tokenAddress) {
          for (const log of receipt.logs) {
            if (log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
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
        gasUsed: receipt.gasUsed.toString()
      };
      if (callback) {
        await callback({
          text: `Token launched successfully!

**${name}** (${symbol})
Address: \`${tokenAddress || "see tx"}\`
Tx: \`${shortHash(receipt.hash)}\`
Gas used: ${receipt.gasUsed.toString()}

The token is live on a bonding curve. Anyone can buy and sell it now.
View on Basescan: https://basescan.org/tx/${receipt.hash}`
        });
      }
      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (callback) {
        await callback({
          text: `Failed to launch token: ${errMsg}`
        });
      }
      return { success: false, error: errMsg };
    }
  }
};

// src/actions/buy.ts
import { ethers as ethers2 } from "ethers";
var examples2 = [
  [
    {
      name: "user",
      content: {
        text: "Buy 0.01 ETH worth of 0x1234567890abcdef1234567890abcdef12345678"
      }
    },
    {
      name: "agent",
      content: {
        text: "Buying tokens with 0.01 ETH on ThryxProtocol...\n\nPurchase complete!\nReceived: 1,234,567 TOKENS\nTx: 0xabcd...1234",
        actions: ["THRYX_BUY"]
      }
    }
  ],
  [
    {
      name: "user",
      content: {
        text: "Buy 100 THRYX worth of token 0xabcdef1234567890abcdef1234567890abcdef12"
      }
    },
    {
      name: "agent",
      content: {
        text: "Buying tokens with 100 THRYX on ThryxProtocol...\n\nPurchase complete!\nReceived: 5,000,000 TOKENS\nSpent: 100 THRYX\nTx: 0x5678...efgh",
        actions: ["THRYX_BUY"]
      }
    }
  ]
];
var buyAction = {
  name: "THRYX_BUY",
  description: "Buy tokens on ThryxProtocol using ETH or THRYX. Specify the token address and amount to spend. Applies 10% slippage protection.",
  similes: [
    "BUY_TOKEN",
    "PURCHASE_TOKEN",
    "THRYX_PURCHASE",
    "BUY_THRYX_TOKEN",
    "SWAP_FOR_TOKEN"
  ],
  examples: examples2,
  validate: async (runtime, _message) => {
    const key = runtime.getSetting("THRYX_PRIVATE_KEY") || runtime.getSetting("EVM_PRIVATE_KEY");
    return !!key;
  },
  handler: async (runtime, message, _state, _options, callback) => {
    const text = message.content.text || "";
    let tokenAddress = null;
    let amount = null;
    let asset = "eth";
    const addrMatch = text.match(/0x[a-fA-F0-9]{40}/);
    if (addrMatch) {
      tokenAddress = addrMatch[0];
    }
    const amountMatch = text.match(
      /(\d+(?:\.\d+)?)\s*(eth|thryx|weth)/i
    );
    if (amountMatch) {
      amount = amountMatch[1];
      const rawAsset = amountMatch[2].toLowerCase();
      asset = rawAsset === "thryx" ? "thryx" : "eth";
    }
    if (!amount) {
      const numMatch = text.match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        amount = numMatch[1];
      }
    }
    if (!tokenAddress || !isValidAddress(tokenAddress)) {
      if (callback) {
        await callback({
          text: 'I need a valid token address to buy. Try:\n- "Buy 0.01 ETH worth of 0x1234...abcd"\n- "Buy 100 THRYX worth of 0x1234...abcd"'
        });
      }
      return { success: false, error: "No valid token address found" };
    }
    if (!amount || parseFloat(amount) <= 0) {
      if (callback) {
        await callback({
          text: 'I need an amount to spend. Try:\n- "Buy 0.01 ETH worth of 0x1234...abcd"\n- "Buy 100 THRYX worth of 0x1234...abcd"'
        });
      }
      return { success: false, error: "No valid amount found" };
    }
    try {
      const wallet = getWallet(runtime);
      const protocol = getProtocol(wallet);
      const amountIn = ethers2.parseEther(amount);
      const tokenIn = asset === "eth" ? WETH_ADDRESS : THRYX_ADDRESS;
      const tokenOut = tokenAddress;
      const estimated = await protocol.estimateSwap(
        tokenIn,
        tokenOut,
        amountIn
      );
      const minOut = applySlippage(estimated);
      if (callback) {
        await callback({
          text: `Buying ${shortAddress(tokenAddress)} with ${amount} ${asset.toUpperCase()} on ThryxProtocol...

Estimated output: ${formatTokenAmount(estimated)} tokens
Min output (10% slippage): ${formatTokenAmount(minOut)} tokens`
        });
      }
      let tx;
      if (asset === "eth") {
        tx = await protocol.swap(tokenIn, tokenOut, amountIn, minOut, {
          value: amountIn
        });
      } else {
        const thryx = getERC20(THRYX_ADDRESS, wallet);
        const currentAllowance = await thryx.allowance(
          wallet.address,
          PROTOCOL_ADDRESS
        );
        if (currentAllowance < amountIn) {
          const approveTx = await thryx.approve(
            PROTOCOL_ADDRESS,
            ethers2.MaxUint256
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
        gasUsed: receipt.gasUsed.toString()
      };
      if (callback) {
        await callback({
          text: `Purchase complete!

Spent: ${amount} ${asset.toUpperCase()}
Estimated received: ${formatTokenAmount(estimated)} tokens
Tx: \`${shortHash(receipt.hash)}\`
View: https://basescan.org/tx/${receipt.hash}`
        });
      }
      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (callback) {
        await callback({
          text: `Failed to buy token: ${errMsg}`
        });
      }
      return { success: false, error: errMsg };
    }
  }
};

// src/actions/sell.ts
import { ethers as ethers3 } from "ethers";
var examples3 = [
  [
    {
      name: "user",
      content: {
        text: "Sell all of 0x1234567890abcdef1234567890abcdef12345678"
      }
    },
    {
      name: "agent",
      content: {
        text: "Selling all tokens for THRYX on ThryxProtocol...\n\nSale complete!\nSold: 1,000,000 TOKENS\nReceived: 50.5 THRYX\nTx: 0xabcd...1234",
        actions: ["THRYX_SELL"]
      }
    }
  ],
  [
    {
      name: "user",
      content: {
        text: "Sell 500000 of token 0xabcdef1234567890abcdef1234567890abcdef12"
      }
    },
    {
      name: "agent",
      content: {
        text: "Selling 500,000 tokens for THRYX on ThryxProtocol...\n\nSale complete!\nSold: 500,000 TOKENS\nReceived: 25.2 THRYX\nTx: 0x5678...efgh",
        actions: ["THRYX_SELL"]
      }
    }
  ]
];
var sellAction = {
  name: "THRYX_SELL",
  description: "Sell tokens on ThryxProtocol for THRYX. Specify the token address and amount (or 'all' to sell entire balance). Applies 10% slippage protection.",
  similes: [
    "SELL_TOKEN",
    "DUMP_TOKEN",
    "THRYX_DUMP",
    "SELL_THRYX_TOKEN",
    "SWAP_TOKEN"
  ],
  examples: examples3,
  validate: async (runtime, _message) => {
    const key = runtime.getSetting("THRYX_PRIVATE_KEY") || runtime.getSetting("EVM_PRIVATE_KEY");
    return !!key;
  },
  handler: async (runtime, message, _state, _options, callback) => {
    const text = message.content.text || "";
    let tokenAddress = null;
    let amount = null;
    let sellAll = false;
    const addrMatch = text.match(/0x[a-fA-F0-9]{40}/);
    if (addrMatch) {
      tokenAddress = addrMatch[0];
    }
    if (/\ball\b/i.test(text)) {
      sellAll = true;
    }
    if (!sellAll) {
      const numMatch = text.match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        amount = numMatch[1];
      }
    }
    if (!tokenAddress || !isValidAddress(tokenAddress)) {
      if (callback) {
        await callback({
          text: 'I need a valid token address to sell. Try:\n- "Sell all of 0x1234...abcd"\n- "Sell 500000 of 0x1234...abcd"'
        });
      }
      return { success: false, error: "No valid token address found" };
    }
    if (tokenAddress.toLowerCase() === THRYX_ADDRESS.toLowerCase()) {
      if (callback) {
        await callback({
          text: "Cannot sell THRYX -- it is the core ecosystem token and is protected."
        });
      }
      return { success: false, error: "THRYX is a protected token and cannot be sold" };
    }
    try {
      const wallet = getWallet(runtime);
      const protocol = getProtocol(wallet);
      const token = getERC20(tokenAddress, wallet);
      let amountIn;
      if (sellAll) {
        amountIn = await token.balanceOf(wallet.address);
        if (amountIn === 0n) {
          if (callback) {
            await callback({
              text: `You don't hold any tokens at ${shortAddress(tokenAddress)}.`
            });
          }
          return { success: false, error: "Zero balance" };
        }
      } else if (amount) {
        let decimals = 18;
        try {
          decimals = Number(await token.decimals());
        } catch {
        }
        amountIn = ethers3.parseUnits(amount, decimals);
      } else {
        if (callback) {
          await callback({
            text: `I need an amount to sell (or say 'all'). Try:
- "Sell all of 0x1234...abcd"
- "Sell 500000 of 0x1234...abcd"`
          });
        }
        return { success: false, error: "No amount specified" };
      }
      const tokenIn = tokenAddress;
      const tokenOut = THRYX_ADDRESS;
      const estimated = await protocol.estimateSwap(
        tokenIn,
        tokenOut,
        amountIn
      );
      const minOut = applySlippage(estimated);
      if (callback) {
        await callback({
          text: `Selling ${sellAll ? "all" : amount} tokens of ${shortAddress(tokenAddress)} for THRYX...

Amount: ${formatTokenAmount(amountIn)} tokens
Estimated THRYX out: ${formatTokenAmount(estimated)}
Min out (10% slippage): ${formatTokenAmount(minOut)}`
        });
      }
      const currentAllowance = await token.allowance(
        wallet.address,
        PROTOCOL_ADDRESS
      );
      if (currentAllowance < amountIn) {
        const approveTx = await token.approve(
          PROTOCOL_ADDRESS,
          ethers3.MaxUint256
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
        gasUsed: receipt.gasUsed.toString()
      };
      if (callback) {
        await callback({
          text: `Sale complete!

Sold: ${formatTokenAmount(amountIn)} tokens
Estimated received: ${formatTokenAmount(estimated)} THRYX
Tx: \`${shortHash(receipt.hash)}\`
View: https://basescan.org/tx/${receipt.hash}`
        });
      }
      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (callback) {
        await callback({
          text: `Failed to sell token: ${errMsg}`
        });
      }
      return { success: false, error: errMsg };
    }
  }
};

// src/actions/info.ts
import { ethers as ethers4 } from "ethers";
var examples4 = [
  [
    {
      name: "user",
      content: {
        text: "Get info on token 0x1234567890abcdef1234567890abcdef12345678"
      }
    },
    {
      name: "agent",
      content: {
        text: "Fetching curve info for 0x1234...5678...\n\nToken: DCAT\nDeployer: 0xabcd...efgh\nSpot price: 0.000001 THRYX\nProgress: 15.5%\nRaised: 155 THRYX / 1000 threshold\nTokens sold: 155M / 800M available\nGraduated: No",
        actions: ["THRYX_INFO"]
      }
    }
  ]
];
var infoAction = {
  name: "THRYX_INFO",
  description: "Get bonding curve info for a token on ThryxProtocol. Shows price, progress, liquidity raised, and graduation status.",
  similes: [
    "TOKEN_INFO",
    "THRYX_TOKEN_INFO",
    "GET_TOKEN_INFO",
    "CHECK_TOKEN",
    "TOKEN_STATUS",
    "CURVE_INFO"
  ],
  examples: examples4,
  validate: async (_runtime, _message) => {
    return true;
  },
  handler: async (_runtime, message, _state, _options, callback) => {
    const text = message.content.text || "";
    const addrMatch = text.match(/0x[a-fA-F0-9]{40}/);
    const tokenAddress = addrMatch ? addrMatch[0] : null;
    if (!tokenAddress || !isValidAddress(tokenAddress)) {
      if (callback) {
        await callback({
          text: 'I need a valid token address. Try:\n- "Get info on 0x1234...abcd"\n- "Check token 0x1234...abcd"'
        });
      }
      return { success: false, error: "No valid token address found" };
    }
    try {
      const provider = getProvider();
      const protocol = new ethers4.Contract(
        PROTOCOL_ADDRESS,
        PROTOCOL_ABI,
        provider
      );
      const curveInfo = await protocol.getCurveInfo(tokenAddress);
      const [
        deployer,
        spotPrice,
        raised,
        threshold,
        progressBps,
        tokensSold,
        tokensAvailable,
        graduated,
        aeroPool,
        creatorFees,
        protocolFees
      ] = curveInfo;
      let symbol = "UNKNOWN";
      try {
        const token = getERC20(tokenAddress, provider);
        symbol = await token.symbol();
      } catch {
      }
      const progressPct = (Number(progressBps) / 100).toFixed(1);
      const result = {
        success: true,
        token: tokenAddress,
        symbol,
        deployer,
        spotPrice: formatTokenAmount(spotPrice),
        raised: formatTokenAmount(raised),
        threshold: formatTokenAmount(threshold),
        progressPercent: progressPct,
        tokensSold: formatTokenAmount(tokensSold),
        tokensAvailable: formatTokenAmount(tokensAvailable),
        graduated,
        aeroPool,
        creatorFees: formatTokenAmount(creatorFees),
        protocolFees: formatTokenAmount(protocolFees)
      };
      if (callback) {
        const poolLine = graduated ? `Aerodrome pool: \`${shortAddress(aeroPool)}\`` : "Not yet graduated";
        await callback({
          text: [
            `**${symbol}** \u2014 ${shortAddress(tokenAddress)}`,
            "",
            `Deployer: \`${shortAddress(deployer)}\``,
            `Spot price: ${formatTokenAmount(spotPrice)} THRYX`,
            `Progress: ${progressPct}% (${formatTokenAmount(raised)} / ${formatTokenAmount(threshold)} THRYX)`,
            `Tokens sold: ${formatTokenAmount(tokensSold)}`,
            `Tokens available: ${formatTokenAmount(tokensAvailable)}`,
            `Graduated: ${graduated ? "Yes" : "No"}`,
            poolLine,
            `Creator fees: ${formatTokenAmount(creatorFees)} THRYX`,
            `Protocol fees: ${formatTokenAmount(protocolFees)} THRYX`
          ].join("\n")
        });
      }
      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (callback) {
        await callback({
          text: `Failed to get token info: ${errMsg}`
        });
      }
      return { success: false, error: errMsg };
    }
  }
};

// src/actions/claim.ts
var examples5 = [
  [
    {
      name: "user",
      content: {
        text: "Claim creator fees for 0x1234567890abcdef1234567890abcdef12345678"
      }
    },
    {
      name: "agent",
      content: {
        text: "Claiming creator fees for 0x1234...5678...\n\nClaimed 12.5 THRYX in creator fees!\nTx: 0xabcd...1234",
        actions: ["THRYX_CLAIM"]
      }
    }
  ]
];
var claimAction = {
  name: "THRYX_CLAIM",
  description: "Claim accumulated creator fees (in THRYX) for a token you deployed on ThryxProtocol. You must be the token's deployer.",
  similes: [
    "CLAIM_FEES",
    "THRYX_CLAIM_FEES",
    "COLLECT_FEES",
    "CLAIM_CREATOR_FEES",
    "CLAIM_THRYX_FEES",
    "WITHDRAW_FEES"
  ],
  examples: examples5,
  validate: async (runtime, _message) => {
    const key = runtime.getSetting("THRYX_PRIVATE_KEY") || runtime.getSetting("EVM_PRIVATE_KEY");
    return !!key;
  },
  handler: async (runtime, message, _state, _options, callback) => {
    const text = message.content.text || "";
    const addrMatch = text.match(/0x[a-fA-F0-9]{40}/);
    const tokenAddress = addrMatch ? addrMatch[0] : null;
    if (!tokenAddress || !isValidAddress(tokenAddress)) {
      if (callback) {
        await callback({
          text: 'I need a valid token address to claim fees for. Try:\n- "Claim fees for 0x1234...abcd"'
        });
      }
      return { success: false, error: "No valid token address found" };
    }
    try {
      const wallet = getWallet(runtime);
      const protocol = getProtocol(wallet);
      const curveInfo = await protocol.getCurveInfo(tokenAddress);
      const creatorFees = curveInfo[9];
      if (creatorFees === 0n) {
        if (callback) {
          await callback({
            text: `No creator fees to claim for ${shortAddress(tokenAddress)}.`
          });
        }
        return { success: true, claimed: "0", token: tokenAddress };
      }
      if (callback) {
        await callback({
          text: `Claiming ${formatTokenAmount(creatorFees)} THRYX in creator fees for ${shortAddress(tokenAddress)}...`
        });
      }
      const tx = await protocol.claimCreatorFees(tokenAddress);
      const receipt = await tx.wait();
      const result = {
        success: true,
        token: tokenAddress,
        claimed: formatTokenAmount(creatorFees),
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString()
      };
      if (callback) {
        await callback({
          text: `Claimed ${formatTokenAmount(creatorFees)} THRYX in creator fees!

Token: ${shortAddress(tokenAddress)}
Tx: \`${shortHash(receipt.hash)}\`
View: https://basescan.org/tx/${receipt.hash}`
        });
      }
      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (callback) {
        await callback({
          text: `Failed to claim fees: ${errMsg}`
        });
      }
      return { success: false, error: errMsg };
    }
  }
};

// src/providers/protocol.ts
import { ethers as ethers5 } from "ethers";
var protocolProvider = {
  name: "THRYX_PROTOCOL",
  description: "Provides ThryxProtocol stats (tokens launched, graduated, fees, reserves) as context for the agent.",
  get: async (_runtime, _message, _state) => {
    try {
      const provider = getProvider();
      const protocol = new ethers5.Contract(
        PROTOCOL_ADDRESS,
        PROTOCOL_ABI,
        provider
      );
      const stats = await protocol.getProtocolStats();
      const [launched, graduated, lifetimeFees, thryxReserves, ethReserves, ethRate] = stats;
      const data = {
        launched: Number(launched),
        graduated: Number(graduated),
        lifetimeFees: formatTokenAmount(lifetimeFees),
        thryxReserves: formatTokenAmount(thryxReserves),
        ethReserves: formatTokenAmount(ethReserves),
        ethRate: formatTokenAmount(ethRate),
        contract: PROTOCOL_ADDRESS,
        network: "Base mainnet",
        chainId: 8453,
        fee: "0.5%",
        feeSplit: "70% creator / 30% protocol"
      };
      const text = [
        "ThryxProtocol v2.3 (Base mainnet)",
        `Contract: ${PROTOCOL_ADDRESS}`,
        `Tokens launched: ${data.launched}`,
        `Tokens graduated: ${data.graduated}`,
        `Lifetime fees: ${data.lifetimeFees} THRYX`,
        `THRYX reserves: ${data.thryxReserves}`,
        `ETH reserves: ${data.ethReserves}`,
        `ETH/THRYX rate: ${data.ethRate}`,
        `Trade fee: 0.5% (70% creator / 30% protocol)`,
        `Launch cost: gas only (~$0.01 on Base)`
      ].join("\n");
      return { text, data, values: data };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        text: `ThryxProtocol stats unavailable: ${errMsg}`,
        data: { error: errMsg }
      };
    }
  }
};

// src/index.ts
var thryxPlugin = {
  name: "@thryx/elizaos-plugin",
  description: "ThryxProtocol plugin for ElizaOS \u2014 launch, buy, sell tokens and claim fees on Base mainnet. The AI Agent Launchpad.",
  actions: [launchAction, buyAction, sellAction, infoAction, claimAction],
  providers: [protocolProvider]
};
var index_default = thryxPlugin;
export {
  CHAIN_ID,
  DEFAULT_SLIPPAGE_BPS,
  ERC20_ABI,
  PROTOCOL_ABI,
  PROTOCOL_ADDRESS,
  RPC_URL,
  THRYX_ADDRESS,
  WETH_ADDRESS,
  applySlippage,
  buyAction,
  claimAction,
  index_default as default,
  formatTokenAmount,
  getERC20,
  getProtocol,
  getProvider,
  getWallet,
  infoAction,
  isValidAddress,
  launchAction,
  parseTokenAmount,
  protocolProvider,
  sellAction,
  shortAddress,
  shortHash,
  thryxPlugin
};
