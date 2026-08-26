// src/cache/ICacheStore.ts
export interface CacheEntry<T> {
  data: T;
  etag?: string;
  createdAt: number;
  expiresAt: number;
  tags: string[];
}

export interface ICacheStore {
  get<T>(key: string): CacheEntry<T> | undefined;
  set<T>(key: string, entry: CacheEntry<T>): void;
  delete(key: string): void;
  invalidateByTag(tag: string): number;
  clear(): void;
}
