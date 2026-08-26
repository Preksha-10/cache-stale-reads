// tests/staleRead.test.ts
import { MockServer } from "../src/mocks/MockServer";
import { HttpClient } from "../src/http/HttpClient";
import { MemoryCacheStore } from "../src/cache/MemoryCacheStore";
import { CacheLogger } from "../src/logger/CacheLogger";
import { CachedApiClient } from "../src/http/CachedApiClient";
import { ItemsService } from "../src/services/ItemsService";

describe("Stale read / cross-user leakage bug", () => {
  it("reproduces leakage when the cache key ignores query params (the original bug)", async () => {
    const server = new MockServer();
    const http = new HttpClient(server.fetch);
    const cache = new MemoryCacheStore();

    const buggyKey = "/api/items"; // <-- bug: no userId in the key
    const res = await http.request("/api/items?userId=user-1");
    cache.set(buggyKey, {
      data: await res.json(),
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      tags: [],
    });

    // user-2 would incorrectly receive user-1's cached data
    const leaked = cache.get<any>(buggyKey)!.data;
    expect(leaked[0].name).toBe("Widget");
  });

  it("fixed client isolates users and refreshes after mutation", async () => {
    const server = new MockServer();
    const http = new HttpClient(server.fetch);
    const cache = new MemoryCacheStore();
    const logger = new CacheLogger();
    const api = new CachedApiClient(http, cache, logger);
    const items = new ItemsService(api);

    const listUser1 = await items.getList("user-1");
    const listUser2 = await items.getList("user-2");
    expect(listUser1[0].name).toBe("Widget");
    expect(listUser2[0].name).toBe("Gadget");

    await items.updateItem("user-1", "a1", { value: 999 });

    const refreshedUser1 = await items.getList("user-1"); // must be a MISS, not stale
    expect(refreshedUser1[0].value).toBe(999);

    const untouchedUser2 = await items.getList("user-2"); // still cached, unaffected
    expect(untouchedUser2[0].name).toBe("Gadget");
  });
});
