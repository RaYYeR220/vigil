import { describe, expect, it } from "vitest";
import { DepegDetector } from "../src/depeg.js";
import { HealthFactorDetector } from "../src/healthFactor.js";
import { TreasuryFloorDetector } from "../src/treasuryFloor.js";

const E18 = 1000000000000000000n;
const now = () => 1000;

describe("HealthFactorDetector", () => {
  const make = (hfRaw: bigint, threshold: number) =>
    new HealthFactorDetector({
      read: async () => [0n, 0n, 0n, 0n, 0n, hfRaw],
      pool: "0xpool",
      user: "0xuser",
      chainId: 8453,
      threshold,
      now,
    });

  it("fires critical when hf is well below threshold", async () => {
    const e = await make((12n * E18) / 10n, 1.5).poll();
    expect(e?.type).toBe("liquidation");
    expect(e?.observedValue).toBeCloseTo(1.2);
    expect(e?.severity).toBe("critical");
  });

  it("fires warn between 0.9*threshold and threshold", async () => {
    const e = await make((14n * E18) / 10n, 1.5).poll();
    expect(e?.severity).toBe("warn");
  });

  it("does not fire at or above threshold", async () => {
    expect(await make(2n * E18, 1.5).poll()).toBeNull();
  });
});

describe("DepegDetector", () => {
  const make = (answer: bigint, thresholdBps: number) =>
    new DepegDetector({
      read: async () => [0n, answer, 0n, 0n, 0n],
      feed: "0xfeed",
      feedDecimals: 8,
      chainId: 8453,
      asset: "USDC",
      thresholdBps,
      now,
    });

  it("fires when deviation exceeds the threshold", async () => {
    const e = await make(97000000n, 50).poll();
    expect(e?.type).toBe("depeg");
    expect(e?.observedValue).toBeCloseTo(0.97);
    expect(e?.severity).toBe("critical");
  });

  it("does not fire when on peg", async () => {
    expect(await make(100000000n, 50).poll()).toBeNull();
  });
});

describe("TreasuryFloorDetector", () => {
  const make = (bal: bigint, floor: bigint) =>
    new TreasuryFloorDetector({
      getBalance: async () => bal,
      account: "0xtreasury",
      chainId: 8453,
      floorWei: floor,
      now,
    });

  it("fires below the floor", async () => {
    const e = await make(5n, 10n).poll();
    expect(e?.type).toBe("treasury-floor");
    expect(e?.severity).toBe("warn");
  });

  it("does not fire at or above the floor", async () => {
    expect(await make(10n, 10n).poll()).toBeNull();
  });
});
