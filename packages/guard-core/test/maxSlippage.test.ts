import { describe, expect, it } from "vitest";
import { checkMaxSlippage } from "../src/rules/maxSlippage.js";
describe("checkMaxSlippage", () => {
  it("passes when policy unset", () => expect(checkMaxSlippage({}, { ok: true })).toBeNull());
  it("fails when sim omits slippage but policy requires it", () =>
    expect(checkMaxSlippage({ maxSlippageBps: 50 }, { ok: true })?.rule).toBe("max-slippage"));
  it("passes when slippage within bound", () =>
    expect(
      checkMaxSlippage({ maxSlippageBps: 50 }, { ok: true, resultingState: { slippageBps: 30 } }),
    ).toBeNull());
  it("fails when slippage over bound", () =>
    expect(
      checkMaxSlippage({ maxSlippageBps: 50 }, { ok: true, resultingState: { slippageBps: 80 } })
        ?.rule,
    ).toBe("max-slippage"));
});
