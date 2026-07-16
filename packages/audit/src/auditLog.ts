import { createHash } from "node:crypto";
import type {
  AuditRecord,
  ExecutionReceipt,
  GuardDecision,
  ProposedAction,
  RiskEvent,
} from "@vigil/guard-core";
import { canonicalize } from "./canonicalize.js";

export type AuditInput = {
  event: RiskEvent;
  action: ProposedAction;
  decision: GuardDecision;
  receipt?: ExecutionReceipt;
  ts: number;
};

type SealInput = {
  seq: number;
  prevHash: string;
  event: RiskEvent;
  action: ProposedAction;
  decision: GuardDecision;
  receipt: ExecutionReceipt | undefined;
  ts: number;
};

const GENESIS = "GENESIS";

function seal(fields: SealInput): string {
  return createHash("sha256").update(canonicalize(fields)).digest("hex");
}

/**
 * In-memory, append-only audit log. Each record is chained to its predecessor
 * by hash, so any later mutation of an earlier record is detectable by verify().
 * The core is deterministic: the caller supplies every timestamp.
 */
export class AuditLog {
  private readonly records: AuditRecord[] = [];

  append(input: AuditInput): AuditRecord {
    const prev = this.records.at(-1);
    const seq = prev ? prev.seq + 1 : 0;
    const prevHash = prev ? prev.hash : GENESIS;

    const hash = seal({
      seq,
      prevHash,
      event: input.event,
      action: input.action,
      decision: input.decision,
      receipt: input.receipt,
      ts: input.ts,
    });

    const record: AuditRecord = {
      seq,
      prevHash,
      hash,
      event: input.event,
      action: input.action,
      decision: input.decision,
      ts: input.ts,
      ...(input.receipt !== undefined ? { receipt: input.receipt } : {}),
    };

    this.records.push(record);
    return record;
  }

  /**
   * Re-walk the chain: every record must point at its predecessor's hash and
   * must re-hash to the value it carries. Returns the index of the first record
   * that fails either check.
   */
  verify(): { ok: boolean; brokenAt?: number } {
    let prevHash = GENESIS;
    for (const [i, r] of this.records.entries()) {
      if (r.prevHash !== prevHash) return { ok: false, brokenAt: i };
      const recomputed = seal({
        seq: r.seq,
        prevHash: r.prevHash,
        event: r.event,
        action: r.action,
        decision: r.decision,
        receipt: r.receipt,
        ts: r.ts,
      });
      if (r.hash !== recomputed) return { ok: false, brokenAt: i };
      prevHash = r.hash;
    }
    return { ok: true };
  }

  /** Deep copy of the chain, safe for the caller to keep or mutate. */
  export(): AuditRecord[] {
    return this.records.map((r) => structuredClone(r));
  }

  /** Rebuild a log from previously exported records (e.g. to verify them). */
  static from(records: readonly AuditRecord[]): AuditLog {
    const log = new AuditLog();
    for (const r of records) log.records.push(structuredClone(r));
    return log;
  }
}
