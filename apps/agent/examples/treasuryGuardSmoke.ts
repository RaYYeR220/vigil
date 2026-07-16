/**
 * Live end-to-end wiring of a single treasury guard against Base Sepolia.
 * Reads a real balance, runs the full detect -> plan -> simulate -> gate ->
 * execute -> reconcile -> audit cycle, and lands a real protective transfer.
 * The transaction hash is reconciled from KeeperHub's execution-status endpoint
 * (executions are sponsored / smart-account, so an EOA tx list never shows them).
 *
 * Run: KH_API_KEY=... WALLET=0x... pnpm exec tsx apps/agent/examples/treasuryGuardSmoke.ts
 */
import { AuditLog } from "@vigil/audit";
import { TreasuryFloorDetector } from "@vigil/detect";
import type { RiskEvent } from "@vigil/guard-core";
import { KeeperHubClient } from "@vigil/keeperhub";
import { plan } from "@vigil/planner";
import { type GuardDeps, type GuardSpec, runGuardCycle } from "../src/guardianLoop.js";

const CHAIN_ID = Number(process.env.CHAIN_ID ?? "84532"); // default Base Sepolia
const RPC = process.env.RPC ?? "https://sepolia.base.org";

const apiKey = process.env.KH_API_KEY ?? "";
const wallet = (process.env.WALLET ?? "") as `0x${string}`;
if (!apiKey || !wallet) throw new Error("set KH_API_KEY and WALLET");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const bigintReplacer = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);

async function rpcBalance(addr: string): Promise<bigint> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [addr, "latest"],
    }),
  });
  const j = (await res.json()) as { result: string };
  return BigInt(j.result);
}

const kh = new KeeperHubClient({ apiKey });
const audit = new AuditLog();
const now = () => Math.floor(Date.now() / 1000);

const balance = await rpcBalance(wallet);
console.log(`wallet ${wallet}`);
console.log(`balance: ${balance} wei (${Number(balance) / 1e18} ETH)`);

// Floor above the real balance so the detector fires on genuine on-chain data.
const floorWei = balance + 1n;
const topUpWei = BigInt(process.env.TOPUP_WEI ?? "50000000000000"); // default 0.00005 ETH self-transfer

const guard: GuardSpec = {
  id: "treasury-sepolia",
  detector: new TreasuryFloorDetector({
    getBalance: () => rpcBalance(wallet),
    account: wallet,
    chainId: CHAIN_ID,
    floorWei,
    now,
  }),
  policy: { maxSpendWei: 100_000_000_000_000n, rateLimit: { maxActions: 5, windowSec: 3600 } },
  plan: (e: RiskEvent) => plan(e, { topUpTo: wallet, topUpWei }),
  recentActionTs: [],
};

const deps: GuardDeps = {
  keeperhub: kh as unknown as GuardDeps["keeperhub"],
  audit,
  // Authoritative reconcile: poll KeeperHub's execution status for the tx hash.
  reconcile: async (_chainId, exec) => {
    for (let i = 0; i < 15; i++) {
      const s = await kh.getExecutionStatus(exec.executionId);
      if (s.transactionHash) return s.transactionHash;
      if (s.status === "failed") return undefined;
      await sleep(2000);
    }
    return undefined;
  },
  now,
};

console.log("\nrunning guard cycle...\n");
const results = await runGuardCycle([guard], deps);

console.log("cycle results:", JSON.stringify(results, bigintReplacer, 2));
console.log("\naudit chain verify:", JSON.stringify(audit.verify()));
console.log("audit trail:", JSON.stringify(audit.export(), bigintReplacer, 2));

const txHash = results[0]?.txHash;
const explorer = CHAIN_ID === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org";
if (txHash) console.log(`\nBaseScan: ${explorer}/tx/${txHash}`);
