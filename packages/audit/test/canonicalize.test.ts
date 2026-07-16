import { describe, expect, it } from "vitest";
import { canonicalize } from "../src/canonicalize.js";

describe("canonicalize", () => {
  it("is stable regardless of key insertion order", () => {
    const a = canonicalize({ b: 1, a: 2, c: 3 });
    const b = canonicalize({ c: 3, a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1,"c":3}');
  });

  it("sorts keys of nested objects", () => {
    const out = canonicalize({ z: { y: 1, x: 2 }, a: [{ n: 1, m: 2 }] });
    expect(out).toBe('{"a":[{"m":2,"n":1}],"z":{"x":2,"y":1}}');
  });

  it("serializes bigint as its decimal string", () => {
    expect(canonicalize({ v: 1000000000000000000n })).toBe('{"v":"1000000000000000000"}');
    expect(canonicalize([1n, 2n])).toBe('["1","2"]');
  });

  it("preserves array order", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  });

  it("skips undefined object properties like JSON does", () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it("renders null and booleans", () => {
    expect(canonicalize({ a: null, b: true, c: false })).toBe('{"a":null,"b":true,"c":false}');
  });

  it("escapes strings", () => {
    expect(canonicalize({ s: 'a"b' })).toBe('{"s":"a\\"b"}');
  });
});
