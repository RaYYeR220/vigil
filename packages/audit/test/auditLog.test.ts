import type { ExecutionReceipt, GuardDecision, ProposedAction, RiskEvent } from "@vigil/guard-core";
import { describe, expect, it } from "vitest";
import { AuditLog } from "../src/auditLog.js";

const event: RiskEvent = {
  type: "liquidation",
  chainId: 8453,
  subject: "0xvault",
  observedValue: 1.02,
  threshold: 1.1,
  severity: "critical",
  ts: 1000,
};

const action: ProposedAction = {
  chainId: 8453,
  kind: "contract-call",
  to: "0xabc",
  functionName: "repay",
  args: ["0xdef", "1000"],
  value: 0n,
};

const decision: GuardDecision = {
  verdict: "allow",
  failures: [],
  simulation: { ok: true, gasEstimate: 21000n },
};

const receipt: ExecutionReceipt = {
  executionId: "ex-1",
  status: "confirmed",
  retries: 0,
  route: "private",
  ts: 1001,
  gasUsed: 21000n,
};

describe("AuditLog.append", () => {
  it("assigns incrementing seq starting at 0", () => {
    const log = new AuditLog();
    const r0 = log.append({ event, action, decision, ts: 1000 });
    const r1 = log.append({ event, action, decision, ts: 1001 });
    const r2 = log.append({ event, action, decision, ts: 1002 });
    expect([r0.seq, r1.seq, r2.seq]).toEqual([0, 1, 2]);
  });

  it("seals the first record with prevHash GENESIS", () => {
    const r0 = new AuditLog().append({ event, action, decision, ts: 1000 });
    expect(r0.prevHash).toBe("GENESIS");
  });

  it("links each record's prevHash to the previous record's hash", () => {
    const log = new AuditLog();
    const r0 = log.append({ event, action, decision, ts: 1000 });
    const r1 = log.append({ event, action, decision, ts: 1001 });
    expect(r1.prevHash).toBe(r0.hash);
  });

  it("produces a 64-char hex sha256 hash", () => {
    const r0 = new AuditLog().append({ event, action, decision, ts: 1000 });
    expect(r0.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for identical input", () => {
    const a = new AuditLog().append({ event, action, decision, ts: 1000 });
    const b = new AuditLog().append({ event, action, decision, ts: 1000 });
    expect(a.hash).toBe(b.hash);
  });

  it("stores the receipt when provided", () => {
    const r = new AuditLog().append({ event, action, decision, receipt, ts: 1002 });
    expect(r.receipt).toEqual(receipt);
  });

  it("omits the receipt when not provided", () => {
    const r = new AuditLog().append({ event, action, decision, ts: 1000 });
    expect(r.receipt).toBeUndefined();
  });

  it("hashes differently with vs without a receipt", () => {
    const withReceipt = new AuditLog().append({ event, action, decision, receipt, ts: 1000 });
    const withoutReceipt = new AuditLog().append({ event, action, decision, ts: 1000 });
    expect(withReceipt.hash).not.toBe(withoutReceipt.hash);
  });
});

describe("AuditLog export / from", () => {
  it("exports every record in sequence order", () => {
    const log = new AuditLog();
    log.append({ event, action, decision, ts: 1000 });
    log.append({ event, action, decision, receipt, ts: 1001 });
    expect(log.export().map((r) => r.seq)).toEqual([0, 1]);
  });

  it("returns a deep copy so mutating the export cannot corrupt the log", () => {
    const log = new AuditLog();
    log.append({ event, action, decision, ts: 1000 });
    const exported = log.export();
    exported[0].event.observedValue = 999;
    expect(log.export()[0].event.observedValue).toBe(1.02);
  });

  it("round-trips: from(export()) yields equal records", () => {
    const log = new AuditLog();
    log.append({ event, action, decision, ts: 1000 });
    log.append({ event, action, decision, receipt, ts: 1001 });
    const restored = AuditLog.from(log.export());
    expect(restored.export()).toEqual(log.export());
  });
});

describe("AuditLog.verify", () => {
  const seeded = () => {
    const log = new AuditLog();
    log.append({ event, action, decision, ts: 1000 });
    log.append({ event, action, decision, receipt, ts: 1001 });
    log.append({ event, action, decision, ts: 1002 });
    return log;
  };

  it("is ok for an empty chain", () => {
    expect(new AuditLog().verify()).toEqual({ ok: true });
  });

  it("is ok for an untampered chain", () => {
    expect(seeded().verify()).toEqual({ ok: true });
  });

  it("re-imported untampered records still verify", () => {
    expect(AuditLog.from(seeded().export()).verify()).toEqual({ ok: true });
  });

  it("detects a tampered payload and reports the break index", () => {
    const records = seeded().export();
    records[1].event.observedValue = 42;
    expect(AuditLog.from(records).verify()).toEqual({ ok: false, brokenAt: 1 });
  });

  it("detects tampering of the first record", () => {
    const records = seeded().export();
    records[0].action.value = 999n;
    expect(AuditLog.from(records).verify()).toEqual({ ok: false, brokenAt: 0 });
  });

  it("detects a severed prevHash link", () => {
    const records = seeded().export();
    records[2].prevHash = "0".repeat(64);
    expect(AuditLog.from(records).verify()).toEqual({ ok: false, brokenAt: 2 });
  });

  it("detects a swapped hash field", () => {
    const records = seeded().export();
    records[1].hash = records[0].hash;
    expect(AuditLog.from(records).verify()).toEqual({ ok: false, brokenAt: 1 });
  });
});
