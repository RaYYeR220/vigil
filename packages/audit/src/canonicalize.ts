/**
 * Deterministic JSON serialization: object keys are emitted in sorted order at
 * every depth and bigint values become their decimal string. Two structurally
 * equal values always produce the same string, which is what makes the audit
 * hash chain reproducible.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";

  const t = typeof value;
  if (t === "bigint") return JSON.stringify((value as bigint).toString());
  if (t === "number" || t === "boolean" || t === "string") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map((v) => (v === undefined ? "null" : canonicalize(v))).join(",")}]`;
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of Object.keys(obj).sort()) {
      const v = obj[key];
      if (v === undefined) continue;
      parts.push(`${JSON.stringify(key)}:${canonicalize(v)}`);
    }
    return `{${parts.join(",")}}`;
  }

  // undefined / function / symbol have no JSON representation.
  return "null";
}
