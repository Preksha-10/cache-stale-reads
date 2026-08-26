// src/mocks/MockServer.ts
import { FetchLike } from "../http/HttpClient";
import { Item } from "../services/ItemsService";

export class MockServer {
  private readonly db = new Map<string, Item[]>();
  public latencyMs = 5;

  constructor() {
    this.db.set("user-1", [{ id: "a1", name: "Widget", value: 10, updatedAt: Date.now() }]);
    this.db.set("user-2", [{ id: "b1", name: "Gadget", value: 20, updatedAt: Date.now() }]);
  }

  fetch: FetchLike = async (input, init) => {
    await new Promise((r) => setTimeout(r, this.latencyMs));
    const url = new URL(String(input), "[mock.local](http://mock.local)");

    if (url.pathname === "/api/items" && (init?.method ?? "GET") === "GET") {
      const userId = url.searchParams.get("userId") ?? "user-1";
      return this.json(this.db.get(userId) ?? []);
    }

    const match = url.pathname.match(/^\/api\/items\/(.+)$/);
    if (match && init?.method === "PATCH") {
      const body = JSON.parse(String(init.body ?? "{}"));
      const userId = body.userId ?? "user-1";
      const items = this.db.get(userId) ?? [];
      const idx = items.findIndex((i) => i.id === match[1]);
      if (idx === -1) return this.json({ error: "not found" }, 404);
      items[idx] = { ...items[idx], ...body, updatedAt: Date.now() };
      return this.json(items[idx]);
    }

    return this.json({ error: "not found" }, 404);
  };

  private json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
