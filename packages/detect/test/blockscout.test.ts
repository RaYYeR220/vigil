import { describe, expect, it } from "vitest";
import { reconcileTxHash } from "../src/blockscout.js";

const mkFetch = (rows: Array<{ hash?: string; from?: string }>) =>
  (async () => ({ json: async () => ({ result: rows }) })) as unknown as typeof fetch;

describe("reconcileTxHash", () => {
  it("returns the newest outgoing tx hash from the address", async () => {
    const hash = await reconcileTxHash({
      fetchFn: mkFetch([
        { hash: "0xnew", from: "0xAbC" },
        { hash: "0xold", from: "0xabc" },
      ]),
      explorerApiBase: "https://base.blockscout.com/api",
      address: "0xabc",
    });
    expect(hash).toBe("0xnew");
  });

  it("skips incoming txs whose from is not the address", async () => {
    const hash = await reconcileTxHash({
      fetchFn: mkFetch([
        { hash: "0xincoming", from: "0xother" },
        { hash: "0xmine", from: "0xabc" },
      ]),
      explorerApiBase: "x",
      address: "0xabc",
    });
    expect(hash).toBe("0xmine");
  });

  it("returns undefined when nothing matches", async () => {
    const hash = await reconcileTxHash({
      fetchFn: mkFetch([{ hash: "0xz", from: "0xother" }]),
      explorerApiBase: "x",
      address: "0xabc",
    });
    expect(hash).toBeUndefined();
  });

  it("returns undefined on an empty result", async () => {
    const hash = await reconcileTxHash({
      fetchFn: mkFetch([]),
      explorerApiBase: "x",
      address: "0xabc",
    });
    expect(hash).toBeUndefined();
  });
});
