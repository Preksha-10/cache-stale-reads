// src/cache/CacheKeyBuilder.ts
// This is the fix for the original bug: builds a key from path + ALL sorted params,
// so requests that differ only by userId (or any query param) never collide.
export class CacheKeyBuilder {
  static build(
    url: string,
    params: Record<string, string | number | boolean | undefined> = {}
  ): string {
    const parsed = new URL(url, "[internal.local](http://internal.local)");
    const merged = new URLSearchParams(parsed.search);

    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .forEach(([k, v]) => merged.set(k, String(v)));

    const sorted = Array.from(merged.entries()).sort(([a], [b]) => a.localeCompare(b));
    const query = sorted.map(([k, v]) => `${k}=${v}`).join("&");

    return `${parsed.pathname}${query ? `?${query}` : ""}`;
  }
}
