// src/cache/MemoryCacheStore.ts
import { ICacheStore, CacheEntry } from "./ICacheStore";

export class MemoryCacheStore implements ICacheStore {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): CacheEntry<T> | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  set<T>(key: string, entry: CacheEntry<T>): void {
    this.store.set(key, entry as CacheEntry<unknown>);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  invalidateByTag(tag: string): number {
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.tags.includes(tag)) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  clear(): void {
    this.store.clear();
  }
}
