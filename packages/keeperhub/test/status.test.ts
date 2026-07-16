import { describe, expect, it } from "vitest";
import { KeeperHubClient } from "../src/client.js";
import { jsonResponse, recordingFetch } from "./support.js";

describe("getExecutionStatus", () => {
  it("GETs the status route and returns the transaction hash", async () => {
    const { fetchFn, calls } = recordingFetch(() =>
      jsonResponse(200, {
        executionId: "ex1",
        status: "completed",
        type: "transfer",
        transactionHash: "0xabc",
        transactionLink: "https://sepolia.basescan.org/tx/0xabc",
        gasUsedWei: "47693",
        error: null,
      }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    const status = await client.getExecutionStatus("ex1");

    expect(calls[0]?.url).toBe("https://app.keeperhub.com/api/execute/ex1/status");
    expect(calls[0]?.init.method).toBe("GET");
    expect(calls[0]?.headers.get("Authorization")).toBe("Bearer k");
    expect(status.status).toBe("completed");
    expect(status.transactionHash).toBe("0xabc");
    expect(status.transactionLink).toBe("https://sepolia.basescan.org/tx/0xabc");
    expect(status.gasUsedWei).toBe("47693");
  });

  it("preserves non-terminal statuses and omits an absent hash", async () => {
    const { fetchFn } = recordingFetch(() =>
      jsonResponse(200, { executionId: "ex2", status: "pending" }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    const status = await client.getExecutionStatus("ex2");
    expect(status.status).toBe("pending");
    expect(status.transactionHash).toBeUndefined();
  });

  it("surfaces a failed execution", async () => {
    const { fetchFn } = recordingFetch(() =>
      jsonResponse(200, { executionId: "ex3", status: "failed", error: "reverted" }),
    );
    const client = new KeeperHubClient({ apiKey: "k", fetchFn });
    const status = await client.getExecutionStatus("ex3");
    expect(status.status).toBe("failed");
    expect(status.error).toBe("reverted");
  });
});
