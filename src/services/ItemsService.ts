// src/services/ItemsService.ts
import { CachedApiClient } from "../http/CachedApiClient";

export interface Item {
  id: string;
  name: string;
  value: number;
  updatedAt: number;
}

export class ItemsService {
  constructor(
    private readonly api: CachedApiClient,
    private readonly baseUrl = "/api/items"
  ) {}

  private tagForUser(userId: string): string {
    return `items:user:${userId}`;
  }

  getList(userId: string): Promise<Item[]> {
    return this.api.get<Item[]>(this.baseUrl, {
      params: { userId },
      tags: [this.tagForUser(userId)],
      ttlMs: 60_000,
    });
  }

  updateItem(userId: string, itemId: string, patch: Partial<Item>): Promise<Item> {
    return this.api.mutate<Item>(`${this.baseUrl}/${itemId}`, {
      method: "PATCH",
      body: { ...patch, userId },
      invalidateTags: [this.tagForUser(userId)],
    });
  }
}
