import type { Hex, RiskEvent } from "@vigil/guard-core";
import type { ReadFn } from "./healthFactor.js";

const CHAINLINK_ABI = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

export type DepegDetectorConfig = {
  read: ReadFn;
  feed: Hex;
  feedDecimals: number;
  chainId: number;
  asset: string;
  peg?: number;
  thresholdBps: number;
  now: () => number;
};

/** Watches a price feed and fires when an asset deviates from its peg beyond a bps threshold. */
export class DepegDetector {
  constructor(private readonly cfg: DepegDetectorConfig) {}

  async poll(): Promise<RiskEvent | null> {
    const res = (await this.cfg.read({
      address: this.cfg.feed,
      abi: CHAINLINK_ABI,
      functionName: "latestRoundData",
    })) as readonly unknown[];
    const price = Number(res[1] as bigint) / 10 ** this.cfg.feedDecimals;
    const peg = this.cfg.peg ?? 1;
    const deviationBps = (Math.abs(price - peg) / peg) * 10000;
    if (deviationBps > this.cfg.thresholdBps) {
      return {
        type: "depeg",
        chainId: this.cfg.chainId,
        subject: this.cfg.asset,
        observedValue: price,
        threshold: peg,
        severity: deviationBps > this.cfg.thresholdBps * 2 ? "critical" : "warn",
        ts: this.cfg.now(),
      };
    }
    return null;
  }
}
