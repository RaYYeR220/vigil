import { writeFileSync } from "node:fs";
import { AuditLog } from "@vigil/audit";
import type { ProposedAction, RiskEvent } from "@vigil/guard-core";

const H = (a: string) => a as `0x${string}`;
const log = new AuditLog();

const ev = (
  type: RiskEvent["type"],
  chainId: number,
  subject: string,
  observedValue: number,
  threshold: number,
  severity: RiskEvent["severity"],
  ts: number,
): RiskEvent => ({ type, chainId, subject, observedValue, threshold, severity, ts });

const call = (
  chainId: number,
  to: string,
  functionName: string,
  spendWei: bigint,
): ProposedAction => ({ chainId, kind: "contract-call", to: H(to), functionName, spendWei });
const xfer = (chainId: number, to: string, value: bigint): ProposedAction => ({
  chainId,
  kind: "transfer",
  to: H(to),
  value,
  spendWei: value,
});

const AAVE = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";
const ROUTER = "0x2626664c2603336E57B271c5C0b26F421741e481";
const ME = "0xA756780c282514dBFBDE87726F83e4AEB8B5Ce6b";

// 1 — treasury guard, executed, REAL Base mainnet tx
log.append({
  event: ev("treasury-floor", 8453, ME, 5e13, 5e13 + 1, "warn", 1784176405),
  action: xfer(8453, ME, 10_000_000_000_000n),
  decision: { verdict: "allow", failures: [], simulation: { ok: true, gasEstimate: 21000n } },
  receipt: {
    executionId: "6prbmd4mgfht92km2uuu2",
    txHash: H("0xf470488dff89f952d6eba5e556413af5eea9654ba030c127257160bd088ddc55"),
    status: "confirmed",
    route: "public",
    ts: 1784176405,
  },
  ts: 1784176405,
});
// 2 — liquidation, BLOCKED by simulation
log.append({
  event: ev(
    "liquidation",
    8453,
    "0x489ee077994B6658eAfA855C308275EAd8097C4A",
    1.42,
    1.5,
    "warn",
    1784176600,
  ),
  action: call(8453, AAVE, "repay", 0n),
  decision: {
    verdict: "deny",
    failures: [{ rule: "simulation", reason: "Error(ERC20: transfer amount exceeds allowance)" }],
    simulation: { ok: false, revertReason: "Error(ERC20: transfer amount exceeds allowance)" },
  },
  ts: 1784176600,
});
// 3 — depeg, BLOCKED by max-slippage
log.append({
  event: ev("depeg", 8453, "USDC", 0.981, 1.0, "critical", 1784176800),
  action: call(8453, ROUTER, "swapExactTokensForTokens", 0n),
  decision: {
    verdict: "deny",
    failures: [{ rule: "max-slippage", reason: "slippage 240bps > max 50bps" }],
    simulation: { ok: true, gasEstimate: 142000n },
  },
  ts: 1784176800,
});
// 4 — treasury guard, executed, REAL Base Sepolia tx
log.append({
  event: ev("treasury-floor", 84532, ME, 5e13, 5e13 + 1, "warn", 1784177000),
  action: xfer(84532, ME, 50_000_000_000_000n),
  decision: { verdict: "allow", failures: [], simulation: { ok: true, gasEstimate: 21227n } },
  receipt: {
    executionId: "xl08mnc9r5xlyh446azeg",
    txHash: H("0x2ef7e4172128ef55b8e0284642b44c03e3bafea53aae6a217a2155092924bcde"),
    status: "confirmed",
    route: "public",
    ts: 1784177000,
  },
  ts: 1784177000,
});
// 5 — liquidation, BLOCKED by max-spend
log.append({
  event: ev(
    "liquidation",
    8453,
    "0x7c3aED4C7e2C4B8f9a1E5d6F0b3A2c1D8e4F5a6B",
    1.08,
    1.5,
    "critical",
    1784177200,
  ),
  action: call(8453, AAVE, "repay", 5_000_000_000_000_000_000n),
  decision: {
    verdict: "deny",
    failures: [
      {
        rule: "max-spend",
        reason: "spend 5000000000000000000 exceeds maxSpendWei 1000000000000000000",
      },
    ],
    simulation: { ok: true, gasEstimate: 180000n },
  },
  ts: 1784177200,
});
// 6 — depeg, BLOCKED by rate-limit
log.append({
  event: ev("depeg", 8453, "crvUSD", 0.968, 1.0, "critical", 1784177400),
  action: call(8453, ROUTER, "swapExactTokensForTokens", 0n),
  decision: {
    verdict: "deny",
    failures: [{ rule: "rate-limit", reason: "3 actions within 3600s >= limit 3" }],
    simulation: { ok: true, gasEstimate: 151000n },
  },
  ts: 1784177400,
});
// 7 — liquidation, BLOCKED by contract-allowlist
log.append({
  event: ev(
    "liquidation",
    8453,
    "0x1f9dC2B4a6E8f0C3d5A7b9E1F2c4D6a8B0e3C5A1",
    1.33,
    1.5,
    "warn",
    1784177600,
  ),
  action: call(8453, "0xBADc0dE1111111111111111111111111111111111", "repay", 0n),
  decision: {
    verdict: "deny",
    failures: [{ rule: "contract-allowlist", reason: "target 0xBADc0dE… not in allowlist" }],
    simulation: { ok: true, gasEstimate: 165000n },
  },
  ts: 1784177600,
});
// 8 — treasury, BLOCKED by simulation (insufficient balance)
log.append({
  event: ev("treasury-floor", 8453, ME, 4e13, 5e13, "warn", 1784177800),
  action: xfer(8453, ME, 10_000_000_000_000n),
  decision: {
    verdict: "deny",
    failures: [{ rule: "simulation", reason: "insufficient balance for transfer" }],
    simulation: { ok: false, revertReason: "insufficient balance for transfer" },
  },
  ts: 1784177800,
});

const records = log.export();
writeFileSync(
  new URL("../public/demo-data.json", import.meta.url),
  JSON.stringify(records, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 0),
);
console.log(`wrote ${records.length} records; chain verify:`, JSON.stringify(log.verify()));
