import { describe, expect, it } from "vitest";
import { checkMinResultingHealthFactor } from "../src/rules/minResultingHealthFactor.js";

describe("checkMinResultingHealthFactor", () => {
  it("passes when policy unset", () =>
    expect(checkMinResultingHealthFactor({}, { ok: true })).toBeNull());
  it("fails when sim omits health factor but policy requires it", () =>
    expect(
      checkMinResultingHealthFactor({ minResultingHealthFactor: 1.5 }, { ok: true })?.rule,
    ).toBe("min-resulting-health-factor"));
  it("passes when resulting HF >= min", () =>
    expect(
      checkMinResultingHealthFactor(
        { minResultingHealthFactor: 1.5 },
        { ok: true, resultingState: { healthFactor: 2 } },
      ),
    ).toBeNull());
  it("fails when resulting HF < min", () =>
    expect(
      checkMinResultingHealthFactor(
        { minResultingHealthFactor: 1.5 },
        { ok: true, resultingState: { healthFactor: 1.2 } },
      )?.rule,
    ).toBe("min-resulting-health-factor"));
});
