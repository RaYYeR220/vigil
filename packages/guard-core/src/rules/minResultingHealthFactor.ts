import type { Policy, RuleFailure, SimulationResult } from "../types.js";
export function checkMinResultingHealthFactor(
  policy: Policy,
  sim: SimulationResult,
): RuleFailure | null {
  if (policy.minResultingHealthFactor === undefined) return null;
  const hf = sim.resultingState?.healthFactor;
  if (hf === undefined)
    return {
      rule: "min-resulting-health-factor",
      reason: "simulation did not report resulting health factor",
    };
  if (hf < policy.minResultingHealthFactor)
    return {
      rule: "min-resulting-health-factor",
      reason: `resulting HF ${hf} < min ${policy.minResultingHealthFactor}`,
    };
  return null;
}
