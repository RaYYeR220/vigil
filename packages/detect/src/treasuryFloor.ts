import type { RiskEvent } from "@vigil/guard-core";

export type TreasuryFloorDetectorConfig = {
  getBalance: () => Promise<bigint>;
  account: string;
  chainId: number;
  floorWei: bigint;
  now: () => number;
};

/** Watches an account balance and fires when it falls below a configured floor. */
export class TreasuryFloorDetector {
  constructor(private readonly cfg: TreasuryFloorDetectorConfig) {}

  async poll(): Promise<RiskEvent | null> {
    const balance = await this.cfg.getBalance();
    if (balance < this.cfg.floorWei) {
      return {
        type: "treasury-floor",
        chainId: this.cfg.chainId,
        subject: this.cfg.account,
        observedValue: Number(balance),
        threshold: Number(this.cfg.floorWei),
        severity: "warn",
        ts: this.cfg.now(),
      };
    }
    return null;
  }
}
