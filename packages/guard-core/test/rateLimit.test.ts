import { describe, expect, it } from "vitest";
import { checkRateLimit } from "../src/rules/rateLimit.js";
describe("checkRateLimit", () => {
  it("passes when policy unset", () => expect(checkRateLimit({}, { now: 1000 })).toBeNull());
  it("passes when under limit within window", () =>
    expect(
      checkRateLimit(
        { rateLimit: { maxActions: 3, windowSec: 60 } },
        { now: 1000, recentActionTs: [990, 995] },
      ),
    ).toBeNull());
  it("ignores actions outside the window", () =>
    expect(
      checkRateLimit(
        { rateLimit: { maxActions: 1, windowSec: 60 } },
        { now: 1000, recentActionTs: [900] },
      ),
    ).toBeNull());
  it("fails when at/over limit within window", () =>
    expect(
      checkRateLimit(
        { rateLimit: { maxActions: 2, windowSec: 60 } },
        { now: 1000, recentActionTs: [980, 990] },
      )?.rule,
    ).toBe("rate-limit"));
});
