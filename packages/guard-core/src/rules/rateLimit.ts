import type { EvalContext, Policy, RuleFailure } from "../types.js";
export function checkRateLimit(policy: Policy, ctx: EvalContext): RuleFailure | null {
  if (!policy.rateLimit) return null;
  const { maxActions, windowSec } = policy.rateLimit;
  const recent = (ctx.recentActionTs ?? []).filter((ts) => ctx.now - ts < windowSec);
  if (recent.length >= maxActions)
    return {
      rule: "rate-limit",
      reason: `${recent.length} actions within ${windowSec}s >= limit ${maxActions}`,
    };
  return null;
}
