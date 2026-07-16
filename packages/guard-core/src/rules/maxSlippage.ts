import type { Policy, RuleFailure, SimulationResult } from "../types.js";
export function checkMaxSlippage(policy: Policy, sim: SimulationResult): RuleFailure | null {
  if (policy.maxSlippageBps === undefined) return null;
  const s = sim.resultingState?.slippageBps;
  if (s === undefined)
    return { rule: "max-slippage", reason: "simulation did not report slippageBps" };
  if (s > policy.maxSlippageBps)
    return { rule: "max-slippage", reason: `slippage ${s}bps > max ${policy.maxSlippageBps}bps` };
  return null;
}
