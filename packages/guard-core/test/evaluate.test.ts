import { describe, expect, it } from "vitest";
import { evaluate } from "../src/evaluate.js";
import type { ProposedAction } from "../src/types.js";
const action: ProposedAction = { chainId: 8453, kind: "contract-call", to: "0xabc", value: 5n };

describe("evaluate", () => {
  it("allows when all rules pass", () => {
    const d = evaluate(action, { maxSpendWei: 10n }, { ok: true }, { now: 0 });
    expect(d.verdict).toBe("allow");
    expect(d.failures).toEqual([]);
  });
  it("denies and collects every failing rule", () => {
    const d = evaluate(
      { ...action, value: 99n },
      { maxSpendWei: 10n, contractAllowlist: ["0xdef"] },
      { ok: false, revertReason: "revert" },
      { now: 0 },
    );
    expect(d.verdict).toBe("deny");
    const rules = d.failures.map((f) => f.rule).sort();
    expect(rules).toContain("simulation");
    expect(rules).toContain("max-spend");
    expect(rules).toContain("contract-allowlist");
  });
  it("fails closed: sim not ok always denies", () => {
    expect(evaluate(action, {}, { ok: false }, { now: 0 }).verdict).toBe("deny");
  });
});
