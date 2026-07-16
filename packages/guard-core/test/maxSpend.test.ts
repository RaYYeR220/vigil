import { describe, expect, it } from "vitest";
import { checkMaxSpend } from "../src/rules/maxSpend.js";
import type { Policy, ProposedAction } from "../src/types.js";

const base: ProposedAction = { chainId: 8453, kind: "transfer", to: "0xabc" as const };

describe("checkMaxSpend", () => {
  it("passes when no maxSpendWei set", () => {
    expect(checkMaxSpend({ ...base, value: 10n }, {})).toBeNull();
  });
  it("passes when spend within cap", () => {
    expect(checkMaxSpend({ ...base, value: 5n }, { maxSpendWei: 10n })).toBeNull();
  });
  it("fails when spend exceeds cap", () => {
    const f = checkMaxSpend({ ...base, value: 11n }, { maxSpendWei: 10n });
    expect(f?.rule).toBe("max-spend");
  });
  it("uses spendWei over value when present", () => {
    const f = checkMaxSpend({ ...base, value: 1n, spendWei: 50n }, { maxSpendWei: 10n });
    expect(f?.rule).toBe("max-spend");
  });
});
