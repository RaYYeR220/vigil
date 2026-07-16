import type { RiskEvent } from "@vigil/guard-core";
import { describe, expect, it } from "vitest";
import { plan } from "../src/plan.js";

const ev = (type: RiskEvent["type"]): RiskEvent => ({
  type,
  chainId: 8453,
  subject: "0xuser",
  observedValue: 1,
  threshold: 1.5,
  severity: "critical",
  ts: 0,
});

describe("plan", () => {
  it("liquidation defaults to an Aave repay", () => {
    const a = plan(ev("liquidation"), {
      aavePool: "0xpool",
      debtAsset: "0xdebt",
      repayAmount: 100n,
      onBehalfOf: "0xuser",
    });
    expect(a).toMatchObject({
      kind: "contract-call",
      to: "0xpool",
      functionName: "repay",
      spendWei: 0n,
    });
    expect(a.args).toEqual(["0xdebt", 100n, 2, "0xuser"]);
  });

  it("liquidation supply mode produces an Aave supply", () => {
    const a = plan(ev("liquidation"), {
      aavePool: "0xpool",
      mode: "supply",
      collateralAsset: "0xcol",
      supplyAmount: 50n,
      onBehalfOf: "0xuser",
    });
    expect(a.functionName).toBe("supply");
    expect(a.args).toEqual(["0xcol", 50n, "0xuser", 0]);
  });

  it("liquidation without a pool throws", () => {
    expect(() => plan(ev("liquidation"), {})).toThrow(/aavePool/);
  });

  it("depeg produces a DEX swap", () => {
    const a = plan(ev("depeg"), { dexRouter: "0xrouter", swapArgs: [1, 2, 3] });
    expect(a).toMatchObject({
      kind: "contract-call",
      to: "0xrouter",
      functionName: "swapExactTokensForTokens",
      spendWei: 0n,
    });
    expect(a.args).toEqual([1, 2, 3]);
  });

  it("depeg without a router throws", () => {
    expect(() => plan(ev("depeg"), {})).toThrow(/dexRouter/);
  });

  it("treasury-floor produces a transfer", () => {
    const a = plan(ev("treasury-floor"), { topUpTo: "0xsafe", topUpWei: 1000n });
    expect(a).toMatchObject({ kind: "transfer", to: "0xsafe", value: 1000n, spendWei: 1000n });
  });

  it("treasury-floor without config throws", () => {
    expect(() => plan(ev("treasury-floor"), {})).toThrow(/topUpTo/);
  });
});
