import type { Policy, ProposedAction, RuleFailure } from "../types.js";
export function checkContractAllowlist(action: ProposedAction, policy: Policy): RuleFailure | null {
  if (!policy.contractAllowlist) return null;
  const to = action.to.toLowerCase();
  if (!policy.contractAllowlist.some((x) => x.toLowerCase() === to))
    return { rule: "contract-allowlist", reason: `target ${action.to} not in allowlist` };
  return null;
}
