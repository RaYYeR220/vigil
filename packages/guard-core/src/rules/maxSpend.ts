import type { Policy, ProposedAction, RuleFailure } from "../types.js";

export function checkMaxSpend(action: ProposedAction, policy: Policy): RuleFailure | null {
  if (policy.maxSpendWei === undefined) return null;
  const spend = action.spendWei ?? action.value ?? 0n;
  if (spend > policy.maxSpendWei)
    return {
      rule: "max-spend",
      reason: `spend ${spend} exceeds maxSpendWei ${policy.maxSpendWei}`,
    };
  return null;
}
