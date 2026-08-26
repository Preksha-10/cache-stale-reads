// src/server/InMemoryDb.ts
import { Item } from "../services/ItemsService";

export class InMemoryDb {
  private readonly data = new Map<string, Item[]>();

  constructor() {
    this.data.set("user-1", [{ id: "a1", name: "Widget", value: 10, updatedAt: Date.now() }]);
    this.data.set("user-2", [{ id: "b1", name: "Gadget", value: 20, updatedAt: Date.now() }]);
  }

  list(userId: string): Item[] {
    return this.data.get(userId) ?? [];
  }

  update(userId: string, itemId: string, patch: Partial<Item>): Item | undefined {
    const items = this.list(userId);
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx === -1) return undefined;
    items[idx] = { ...items[idx], ...patch, updatedAt: Date.now() };
    return items[idx];
  }
}
