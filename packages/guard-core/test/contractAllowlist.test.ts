import { describe, expect, it } from "vitest";
import { checkContractAllowlist } from "../src/rules/contractAllowlist.js";
import type { ProposedAction } from "../src/types.js";
const a = (to: string): ProposedAction => ({
  chainId: 8453,
  kind: "contract-call",
  to: to as `0x${string}`,
});

describe("checkContractAllowlist", () => {
  it("passes when no allowlist set", () =>
    expect(checkContractAllowlist(a("0xAAA"), {})).toBeNull());
  it("passes when target in allowlist (case-insensitive)", () =>
    expect(checkContractAllowlist(a("0xAbC"), { contractAllowlist: ["0xabc"] })).toBeNull());
  it("fails when target not in allowlist", () =>
    expect(checkContractAllowlist(a("0xDEF"), { contractAllowlist: ["0xabc"] })?.rule).toBe(
      "contract-allowlist",
    ));
});
