import type { Hex, ProposedAction, RiskEvent } from "@vigil/guard-core";

/**
 * Per-response configuration a caller supplies alongside a RiskEvent. Which
 * fields are required depends on the event type (validated at plan() time).
 */
export type PlannerConfig = {
  // liquidation response (Aave v3)
  aavePool?: Hex;
  mode?: "repay" | "supply";
  debtAsset?: Hex;
  repayAmount?: bigint;
  rateMode?: number;
  onBehalfOf?: Hex;
  collateralAsset?: Hex;
  supplyAmount?: bigint;
  // depeg response (DEX swap out to a safe asset)
  dexRouter?: Hex;
  swapFn?: string;
  swapArgs?: readonly unknown[];
  // treasury-floor response (top up)
  topUpTo?: Hex;
  topUpWei?: bigint;
};

/** Map a detected risk into a concrete protective on-chain action. */
export function plan(event: RiskEvent, cfg: PlannerConfig): ProposedAction {
  switch (event.type) {
    case "liquidation": {
      if (cfg.aavePool === undefined) {
        throw new Error("planner: aavePool required for liquidation response");
      }
      if (cfg.mode === "supply") {
        return {
          chainId: event.chainId,
          kind: "contract-call",
          to: cfg.aavePool,
          functionName: "supply",
          args: [cfg.collateralAsset, cfg.supplyAmount, cfg.onBehalfOf, 0],
          spendWei: 0n,
        };
      }
      return {
        chainId: event.chainId,
        kind: "contract-call",
        to: cfg.aavePool,
        functionName: "repay",
        args: [cfg.debtAsset, cfg.repayAmount, cfg.rateMode ?? 2, cfg.onBehalfOf],
        spendWei: 0n,
      };
    }
    case "depeg": {
      if (cfg.dexRouter === undefined) {
        throw new Error("planner: dexRouter required for depeg response");
      }
      return {
        chainId: event.chainId,
        kind: "contract-call",
        to: cfg.dexRouter,
        functionName: cfg.swapFn ?? "swapExactTokensForTokens",
        args: cfg.swapArgs ?? [],
        spendWei: 0n,
      };
    }
    case "treasury-floor": {
      if (cfg.topUpTo === undefined || cfg.topUpWei === undefined) {
        throw new Error("planner: topUpTo and topUpWei required for treasury-floor response");
      }
      return {
        chainId: event.chainId,
        kind: "transfer",
        to: cfg.topUpTo,
        value: cfg.topUpWei,
        spendWei: cfg.topUpWei,
      };
    }
    default: {
      const exhaustive: never = event.type;
      throw new Error(`planner: unknown event type ${String(exhaustive)}`);
    }
  }
}
