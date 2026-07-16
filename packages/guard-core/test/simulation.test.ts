import { describe, expect, it } from "vitest";
import { checkSimulation } from "../src/rules/simulation.js";
describe("checkSimulation", () => {
  it("passes when sim ok", () => expect(checkSimulation({ ok: true })).toBeNull());
  it("fails with revert reason when sim not ok", () =>
    expect(checkSimulation({ ok: false, revertReason: "HF too low" })).toEqual({
      rule: "simulation",
      reason: "HF too low",
    }));
  it("fails with generic reason when none given", () =>
    expect(checkSimulation({ ok: false })?.reason).toBe("simulation failed"));
});
