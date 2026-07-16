import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { evaluate } from "../src/evaluate.js";
import { checkMaxSpend } from "../src/rules/maxSpend.js";
import type { EvalContext, Policy, ProposedAction, SimulationResult } from "../src/types.js";

const hex = fc.hexaString({ minLength: 1, maxLength: 6 }).map((s) => `0x${s}` as `0x${string}`);
const bigintArb = fc.bigInt({ min: 0n, max: 10n ** 30n });
const action = fc.record({
  chainId: fc.constant(8453),
  kind: fc.constantFrom("transfer", "contract-call") as fc.Arbitrary<ProposedAction["kind"]>,
  to: hex,
  value: fc.option(bigintArb, { nil: undefined }),
  spendWei: fc.option(bigintArb, { nil: undefined }),
});
const policy = fc.record({
  maxSpendWei: fc.option(bigintArb, { nil: undefined }),
  contractAllowlist: fc.option(fc.array(hex), { nil: undefined }),
  minResultingHealthFactor: fc.option(fc.double({ min: 0, max: 10, noNaN: true }), {
    nil: undefined,
  }),
  maxSlippageBps: fc.option(fc.nat({ max: 10000 }), { nil: undefined }),
  rateLimit: fc.option(
    fc.record({ maxActions: fc.nat({ max: 10 }), windowSec: fc.nat({ max: 3600 }) }),
    { nil: undefined },
  ),
}) as fc.Arbitrary<Policy>;
const sim = fc.record({
  ok: fc.boolean(),
  resultingState: fc.option(
    fc.record({
      healthFactor: fc.option(fc.double({ min: 0, max: 10, noNaN: true }), { nil: undefined }),
      slippageBps: fc.option(fc.nat({ max: 20000 }), { nil: undefined }),
    }),
    { nil: undefined },
  ),
}) as fc.Arbitrary<SimulationResult>;
const ctx = fc.record({
  now: fc.nat(),
  recentActionTs: fc.option(fc.array(fc.nat()), { nil: undefined }),
}) as fc.Arbitrary<EvalContext>;

describe("guard invariants", () => {
  it("allow <=> zero failures", () => {
    fc.assert(
      fc.property(action, policy, sim, ctx, (a, p, s, c) => {
        const d = evaluate(a as ProposedAction, p, s, c);
        return (d.verdict === "allow") === (d.failures.length === 0);
      }),
    );
  });

  it("a failed simulation is NEVER allowed (fail-closed)", () => {
    fc.assert(
      fc.property(action, policy, sim, ctx, (a, p, s, c) => {
        const d = evaluate(a as ProposedAction, { ...p }, { ...s, ok: false }, c);
        return d.verdict === "deny";
      }),
    );
  });

  it("a policy-violating spend is NEVER allowed", () => {
    fc.assert(
      fc.property(action, policy, sim, ctx, (a, p, s, c) => {
        const d = evaluate(a as ProposedAction, p, s, c);
        if (d.verdict !== "allow") return true; // only allow decisions must be clean
        return checkMaxSpend(a as ProposedAction, p) === null; // allow implies spend rule individually passes
      }),
    );
  });
});
