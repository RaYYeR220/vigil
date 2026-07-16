import { describe, expect, it } from "vitest";
import { KeeperHubClient } from "../src/client.js";
import { jsonResponse, recordingFetch } from "./support.js";

describe("KeeperHubClient.executeTransfer", () => {
  it("returns the executionId and status from a 202", async () => {
    const { fetchFn } = recordingFetch(() =>
      jsonResponse(202, { executionId: "ex-123", status: "completed" }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    const result = await client.executeTransfer({
      chainId: 8453,
      recipientAddress: "0xr",
      amount: "2.0",
    });
    expect(result).toEqual({ executionId: "ex-123", status: "completed" });
  });

  it("surfaces a failed execution status", async () => {
    const { fetchFn } = recordingFetch(() =>
      jsonResponse(202, { executionId: "ex-9", status: "failed" }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    const result = await client.executeTransfer({
      chainId: 1,
      recipientAddress: "0xr",
      amount: "1",
    });
    expect(result.status).toBe("failed");
  });

  it("omits simulate from the request body", async () => {
    const { fetchFn, calls } = recordingFetch(() =>
      jsonResponse(202, { executionId: "ex-1", status: "completed" }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    await client.executeTransfer({ chainId: 1, recipientAddress: "0xr", amount: "1" });
    expect(calls[0].body.simulate).toBeUndefined();
  });

  it("sets the Idempotency-Key header when supplied", async () => {
    const { fetchFn, calls } = recordingFetch(() =>
      jsonResponse(202, { executionId: "ex-1", status: "completed" }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    await client.executeTransfer(
      { chainId: 1, recipientAddress: "0xr", amount: "1" },
      { idempotencyKey: "idem-abc" },
    );
    expect(calls[0].headers.get("idempotency-key")).toBe("idem-abc");
  });

  it("does not set the Idempotency-Key header by default", async () => {
    const { fetchFn, calls } = recordingFetch(() =>
      jsonResponse(202, { executionId: "ex-1", status: "completed" }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    await client.executeTransfer({ chainId: 1, recipientAddress: "0xr", amount: "1" });
    expect(calls[0].headers.has("idempotency-key")).toBe(false);
  });
});

describe("KeeperHubClient.executeContractCall", () => {
  it("serializes functionArgs to a JSON string and returns the execution result", async () => {
    const { fetchFn, calls } = recordingFetch(() =>
      jsonResponse(202, { executionId: "ex-77", status: "completed" }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    const result = await client.executeContractCall({
      chainId: 8453,
      contractAddress: "0xc",
      functionName: "repay",
      functionArgs: ["0xabc", "1000"],
      value: "0",
    });
    expect(calls[0].url).toBe("https://app.keeperhub.com/api/execute/contract-call");
    expect(calls[0].body.functionArgs).toBe('["0xabc","1000"]');
    expect(calls[0].body.value).toBe("0");
    expect(result).toEqual({ executionId: "ex-77", status: "completed" });
  });
});

describe("KeeperHubClient.readContract", () => {
  it("returns the raw result value", async () => {
    const { fetchFn } = recordingFetch(() => jsonResponse(200, { result: "1000000" }));
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    const out = await client.readContract({
      chainId: 1,
      contractAddress: "0xc",
      functionName: "balanceOf",
      functionArgs: ["0xabc"],
    });
    expect(out).toEqual({ result: "1000000" });
  });

  it("omits simulate from a read request", async () => {
    const { fetchFn, calls } = recordingFetch(() => jsonResponse(200, { result: "0" }));
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    await client.readContract({
      chainId: 1,
      contractAddress: "0xc",
      functionName: "balanceOf",
      functionArgs: ["0xabc"],
    });
    expect(calls[0].body.simulate).toBeUndefined();
  });
});
