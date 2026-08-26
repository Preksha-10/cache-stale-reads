// src/http/CachedApiClient.ts
import { ICacheStore } from "../cache/ICacheStore";
import { CacheKeyBuilder } from "../cache/CacheKeyBuilder";
import { HttpClient } from "./HttpClient";
import { CacheLogger } from "../logger/CacheLogger";

export interface GetOptions {
  params?: Record<string, string | number | boolean | undefined>;
  tags?: string[];
  ttlMs?: number;
}

export interface MutationOptions {
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  invalidateTags?: string[];
}

export class CachedApiClient {
  constructor(
    private readonly http: HttpClient,
    private readonly cache: ICacheStore,
    private readonly logger: CacheLogger,
    private readonly defaultTtlMs = 30_000
  ) {}

  async get<T>(url: string, options: GetOptions = {}): Promise<T> {
    const key = CacheKeyBuilder.build(url, options.params);
    const cached = this.cache.get<T>(key);

    if (cached) {
      this.logger.log("hit", `Cache HIT for ${key}`);
      return cached.data;
    }

    this.logger.log("miss", `Cache MISS for ${key}, fetching...`);
    const response = await this.http.request(this.withParams(url, options.params));

    if (!response.ok) {
      throw new Error(`GET ${key} failed with status ${response.status}`);
    }

    const data = (await response.json()) as T;
    const etag = response.headers.get("etag") ?? undefined;
    const ttl = options.ttlMs ?? this.defaultTtlMs;

    this.cache.set<T>(key, {
      data,
      etag,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      tags: options.tags ?? [],
    });

    return data;
  }

  async mutate<T>(url: string, options: MutationOptions = {}): Promise<T> {
    const response = await this.http.request(url, {
      method: options.method ?? "POST",
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`${options.method ?? "POST"} ${url} failed with status ${response.status}`);
    }

    this.logger.log(
      "mutation",
      `Mutation ${options.method ?? "POST"} ${url} completed at ${new Date().toISOString()}`
    );

    (options.invalidateTags ?? []).forEach((tag) => {
      const removed = this.cache.invalidateByTag(tag);
      this.logger.log("invalidate", `Invalidated ${removed} entries for tag "${tag}"`);
    });

    return (await response.json()) as T;
  }

  private withParams(
    url: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    if (!params) return url;
    const u = new URL(url, "[internal.local](http://internal.local)");
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
    });
    return `${u.pathname}${u.search}`;
  }
}
