import { checkContractAllowlist } from "./rules/contractAllowlist.js";
import { checkMaxSlippage } from "./rules/maxSlippage.js";
import { checkMaxSpend } from "./rules/maxSpend.js";
import { checkMinResultingHealthFactor } from "./rules/minResultingHealthFactor.js";
import { checkRateLimit } from "./rules/rateLimit.js";
import { checkSimulation } from "./rules/simulation.js";
import type {
  EvalContext,
  GuardDecision,
  Policy,
  ProposedAction,
  RuleFailure,
  SimulationResult,
} from "./types.js";

export function evaluate(
  action: ProposedAction,
  policy: Policy,
  sim: SimulationResult,
  ctx: EvalContext,
): GuardDecision {
  const maybe: (RuleFailure | null)[] = [
    checkSimulation(sim),
    checkMaxSpend(action, policy),
    checkContractAllowlist(action, policy),
    checkMinResultingHealthFactor(policy, sim),
    checkMaxSlippage(policy, sim),
    checkRateLimit(policy, ctx),
  ];
  const failures = maybe.filter((f): f is RuleFailure => f !== null);
  return { verdict: failures.length === 0 ? "allow" : "deny", failures, simulation: sim };
}
