import type { Hex, RiskEvent } from "@vigil/guard-core";

/**
 * An injected contract reader. In production this is backed by a viem
 * public client (or KeeperHub's read path); in tests it is a stub, so the
 * detector never touches the network.
 */
export type ReadFn = (args: {
  address: Hex;
  abi: unknown;
  functionName: string;
  args?: readonly unknown[];
}) => Promise<unknown>;

const AAVE_POOL_ABI = [
  {
    type: "function",
    name: "getUserAccountData",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
] as const;

export type HealthFactorDetectorConfig = {
  read: ReadFn;
  pool: Hex;
  user: Hex;
  chainId: number;
  threshold: number;
  now: () => number;
};

/** Watches an Aave v3 position's health factor and fires when it drops below a threshold. */
export class HealthFactorDetector {
  constructor(private readonly cfg: HealthFactorDetectorConfig) {}

  async poll(): Promise<RiskEvent | null> {
    const res = (await this.cfg.read({
      address: this.cfg.pool,
      abi: AAVE_POOL_ABI,
      functionName: "getUserAccountData",
      args: [this.cfg.user],
    })) as readonly unknown[];
    const hf = Number(res[5] as bigint) / 1e18;
    if (hf < this.cfg.threshold) {
      return {
        type: "liquidation",
        chainId: this.cfg.chainId,
        subject: this.cfg.user,
        observedValue: hf,
        threshold: this.cfg.threshold,
        severity: hf < this.cfg.threshold * 0.9 ? "critical" : "warn",
        ts: this.cfg.now(),
      };
    }
    return null;
  }
}
