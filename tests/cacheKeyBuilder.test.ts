// tests/cacheKeyBuilder.test.ts
import { CacheKeyBuilder } from "../src/cache/CacheKeyBuilder";

describe("CacheKeyBuilder", () => {
  it("produces distinct keys for different query params", () => {
    const k1 = CacheKeyBuilder.build("/api/items", { userId: "user-1" });
    const k2 = CacheKeyBuilder.build("/api/items", { userId: "user-2" });
    expect(k1).not.toBe(k2);
  });

  it("is order-independent for params", () => {
    const k1 = CacheKeyBuilder.build("/api/items", { a: 1, b: 2 });
    const k2 = CacheKeyBuilder.build("/api/items", { b: 2, a: 1 });
    expect(k1).toBe(k2);
  });
});
