# Cache Stale Reads — Tag-Based Cache Invalidation Fix

A small, production-style TypeScript data-fetch layer that fixes a real caching bug: **GET responses were being cached by URL only, ignoring the `userId` query parameter**, which caused stale lists and cross-user data leakage after a `POST` update. This repo reproduces the bug, fixes it with a proper cache-key builder and tag-based invalidation, and covers the fix with a deterministic, mocked-fetch test suite.

---

## Overview

**The problem:** A client calls `POST` to update an item, then `GET`s the list back. Intermittently, the client sees old (stale) data — or worse, another user's data — because the cache layer keyed responses by the base URL alone and ignored query parameters like `userId`. Two different users hitting the same base list URL collided into the same cache entry.

**The fix:**
- A dedicated **`CacheKeyBuilder`** class turns a URL + all of its query parameters into one deterministic cache key, so `?userId=1` and `?userId=2` never collide.
- Cache entries are invalidated by **tag** (e.g. `resource:items`, `user:1`) rather than by guessing or pattern-matching URLs, so the invalidation logic survives future URL changes.
- A generic **`HttpCacheClient`** owns fetching + caching mechanics only — it has zero knowledge of "items," "users," or any other domain concept.
- A domain-specific **`ItemService`** is the only class that knows what a "list" or an "update" means, and is responsible for triggering the correct tag invalidation after a successful mutation.

This ensures: **the very next `GET` after any successful mutation always returns fresh data for that user — never a stale cached response, and never another user's data.**

---

## Architecture & Design Choices

```
┌─────────────────┐        ┌───────────────────┐        ┌──────────────────┐
│   ItemService    │ knows  │  HttpCacheClient   │ knows  │  CacheKeyBuilder  │
│ (domain logic)   │──uses──▶ (fetch + caching)  │──uses──▶ (URL+params → key)│
│ list() / update()│        │ get() / mutate()   │        └──────────────────┘
└─────────────────┘        └─────────┬──────────┘
                                       │ uses (interface)
                                       ▼
                              ┌──────────────────┐
                              │   ICacheStore     │  ← abstract interface
                              │  (get/set/delete/  │
                              │   invalidateByTag) │
                              └─────────┬──────────┘
                                       │ implements
                                       ▼
                              ┌──────────────────┐
                              │ InMemoryCacheStore │  ← swappable backend
                              └──────────────────┘
```

### Why cache keys are built this way

The original bug existed because the cache key was just the raw URL string (e.g. `/items`), so every user's list request landed on the *same* cache slot regardless of the `userId` query parameter. `CacheKeyBuilder` is the single class responsible for producing a **complete, deterministic key** from a URL and its query parameters:

- Query parameters are extracted, **sorted alphabetically by key**, and re-serialized — so `?userId=1&sort=asc` and `?sort=asc&userId=1` produce the *same* key (order-independent), while `?userId=1` and `?userId=2` produce *different* keys.
- This isolates the "what makes two requests the same" decision into one auditable place, instead of scattering ad-hoc string concatenation across the fetch layer.

### Why invalidation is tag-based instead of URL-based

URL-pattern-matching invalidation (e.g. "delete any cache key that starts with `/items`") is fragile: it silently breaks the moment the URL shape changes (new query param, versioned endpoint, pagination, etc.), and it can't cleanly express "invalidate everything for this user" without re-deriving URL knowledge in a second place.

Instead, every cache entry is stored with a set of **tags** at write time (e.g. `resource:items`, `user:42`). Invalidation asks "which entries carry this tag?" rather than "which URLs look like this?" — so:
- A mutation to user 42's items invalidates exactly the entries tagged `user:42` (or `resource:items` + `user:42`), regardless of what the underlying URL looked like.
- Tags are a domain concept, decided by `ItemService`, and enforced generically by `HttpCacheClient`/`ICacheStore` — no invalidation logic is duplicated between classes.

### Class responsibilities (single responsibility, enforced)

| Class | Responsibility | Knows about domain? |
|---|---|---|
| `CacheKeyBuilder` | URL + query params → deterministic string key | No |
| `ICacheStore` (interface/abstract class) | Contract for get/set/delete/invalidateByTag | No |
| `InMemoryCacheStore` | Concrete, swappable storage backend | No |
| `HttpCacheClient` | Fetch + cache read-through, mutation + tag invalidation trigger, logging | No |
| `ItemService` | What a "list" and an "update" mean for items; which tags apply | Yes — the only one |

---

## Setup & Running

**Requirements:** Node.js 18+, npm

```bash
# install dependencies
npm install

# run the full test suite (mocked fetch, no network calls)
npm test

# run in watch mode
npm run test:watch

# type-check / build
npm run build
```

All tests use a mocked `fetch` implementation — no real HTTP calls are made, so results are fully deterministic and CI-safe.

---

## Testing

Run with `npm test`. The suite includes:

1. **Bug reproduction test** — a cache keyed by raw URL only (ignoring query params) is shown returning **user B's data to user A**, proving the original bug is real.
2. **Cache hit** — a second identical `GET` (same URL + same `userId`) is served from cache, not re-fetched.
3. **Cache miss** — a first-time `GET`, or a `GET` for a different `userId`, always hits the network.
4. **Invalidation after mutation** — after a successful `POST` update, the very next `GET` for that user is guaranteed fresh (cache miss), never stale.
5. **No cross-user leakage** — two different `userId`s hitting the same base list URL never see each other's cached data, before or after either one mutates.

Every cache hit, miss, invalidation, and mutation timestamp is logged to the console during test runs, so the fix is **observable in test output**, not just asserted silently.

---

## Error Handling

- Failed network calls (rejected `fetch` promises, non-2xx responses) are caught inside `HttpCacheClient`, logged with context, and surfaced as a typed result/error rather than throwing raw exceptions or crashing the caller.
- A failed mutation does **not** trigger cache invalidation (stale data is preferable to silently discarding valid cached data on an unrelated failure).
- No secrets or credentials are hardcoded anywhere in the codebase.

---

## Trade-offs & Future Work

**What was intentionally scoped out for the MVP:**
- **ETag / `304 Not Modified` support.** The current fix guarantees correctness (no stale/leaked data) via tag invalidation on write, but every cache miss re-fetches the full payload. Adding `ETag`/`If-None-Match` handling on top of this design would let the server confirm "nothing changed" cheaply on revalidation, saving bandwidth without changing the invalidation model — `HttpCacheClient` already isolates the fetch mechanics, so this would be a localized addition.
- **Persistent/distributed cache backend.** `InMemoryCacheStore` is process-local and resets on restart. Because `ICacheStore` is an interface, swapping in a Redis- or disk-backed implementation requires no changes to `HttpCacheClient` or `ItemService`.
- **TTL / stale-while-revalidate.** Entries currently live until explicitly invalidated by tag; a time-based expiry policy would be a natural next layer.
- **Optimistic UI updates.** The service currently invalidates-then-refetches after a mutation; an optimistic update to the cached list (patched immediately, reconciled on the next real fetch) would reduce perceived latency.

**What this design already gets right for production use:** the storage backend, key strategy, and invalidation strategy are all decoupled behind interfaces/dedicated classes, so each of the items above can be added incrementally without touching unrelated code — which was the explicit goal of the OOP/modularity requirements this project was built against.

---

## Project Structure

```
.
├── src/            # CacheKeyBuilder, ICacheStore, InMemoryCacheStore, HttpCacheClient, ItemService
├── tests/          # Jest test suite (mocked fetch)
├── public/         # static assets (if applicable)
├── jest.config.js
├── tsconfig.json
├── package.json
└── prompt.md       # All prompts used during this challenge
```

---

## Git Hygiene

This project was built with small, atomic commits (cache-key builder, cache store interface, HTTP+cache client, domain service, bug-reproduction test, coverage tests, docs) rather than a single large commit — see the commit history for the incremental build-out.