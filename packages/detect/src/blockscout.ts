import type { Hex } from "@vigil/guard-core";

export type ReconcileArgs = {
  fetchFn: typeof fetch;
  explorerApiBase: string;
  address: Hex;
};

/**
 * KeeperHub's REST execute endpoints return an executionId but no transaction
 * hash, so we recover the hash independently from the block explorer — this
 * doubles as an on-chain verification of what actually landed.
 */
export async function reconcileTxHash({
  fetchFn,
  explorerApiBase,
  address,
}: ReconcileArgs): Promise<Hex | undefined> {
  const url = `${explorerApiBase}?module=account&action=txlist&address=${address}&sort=desc`;
  const res = await fetchFn(url, { headers: { Accept: "application/json" } });
  const body = (await res.json()) as { result?: Array<{ hash?: string; from?: string }> };
  const rows = Array.isArray(body.result) ? body.result : [];
  const lower = address.toLowerCase();
  for (const row of rows) {
    if ((row.from ?? "").toLowerCase() === lower && row.hash) {
      return row.hash as Hex;
    }
  }
  return undefined;
}
