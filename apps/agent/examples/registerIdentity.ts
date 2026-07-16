/**
 * Register the Vigil guardian as an ERC-8004 Trustless Agent on Base mainnet,
 * executed through KeeperHub (gas-sponsored). The agent's registration file is
 * stored fully on-chain as a base64 `data:` URI — no hosted domain required.
 *
 * Vigil is already registered as agentId 59164
 * (ownerOf → the guardian wallet), tx 0x43189a93…adc25a6 on Base mainnet.
 *
 * Run: KH_API_KEY=kh_... pnpm exec tsx apps/agent/examples/registerIdentity.ts
 */
import { KeeperHubClient } from "@vigil/keeperhub";

// ERC-8004 Identity Registry (per-chain singleton) on Base mainnet.
const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;

const apiKey = process.env.KH_API_KEY ?? "";
if (!apiKey) throw new Error("set KH_API_KEY");

const registration = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: "Vigil",
  description:
    "Autonomous on-chain risk guardian. Watches on-chain risk and executes protective actions only after a policy + simulation interlock. Guard-as-a-service on KeeperHub, settled via x402.",
  services: [
    {
      name: "MCP",
      endpoint: "https://app.keeperhub.com/mcp/w/vigil-aave-health-guard",
      version: "2025-06-18",
    },
  ],
};
const agentURI = `data:application/json;base64,${Buffer.from(JSON.stringify(registration)).toString("base64")}`;

const kh = new KeeperHubClient({ apiKey });

// `register` is overloaded on the registry — the full signature disambiguates it.
const exec = await kh.executeContractCall(
  {
    chainId: 8453,
    contractAddress: IDENTITY_REGISTRY,
    functionName: "register(string)",
    functionArgs: [agentURI],
  },
  { idempotencyKey: "vigil-erc8004-register" },
);
console.log("execution:", exec);

for (let i = 0; i < 15; i++) {
  const status = await kh.getExecutionStatus(exec.executionId);
  if (status.transactionHash) {
    console.log("registered:", status.transactionHash, status.transactionLink);
    break;
  }
  if (status.status === "failed") {
    console.log("failed:", status.error);
    break;
  }
  await new Promise((r) => setTimeout(r, 2000));
}
