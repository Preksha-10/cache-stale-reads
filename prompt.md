You are acting as a senior full-stack engineer. Treat this as production client work, not a throwaway script. Follow these rules throughout: strictly follow OOP and modularity, proper documentation, and clean production-grade code.

Debug and fix a small data-fetch layer that returns stale results after mutations. A client calls POST to update an item, then GETs the list, but intermittently still sees old values. Root cause to find and fix: GET responses are being cached/memoized by URL only, ignoring the userId query parameter — meaning two different users hitting the same base URL collide into the same cache entry, causing stale lists and cross-user data leakage after a POST.

Input: a list URL (with a userId query param), an item-update URL, and an update payload. Output: after any successful mutation, the very next GET for that user must return fresh data, never a stale cached response.

Architecture requirements — strictly follow OOP and modularity:

Define a cache store behind an interface (or an abstract base class), not a single concrete implementation, so the storage backend could be swapped later without touching call sites.
A dedicated cache-key builder class is solely responsible for turning a URL plus its query parameters into a complete, deterministic cache key — this is the actual fix, since the original bug came from a key that ignored query parameters entirely.
Invalidate cache entries by tag (e.g. tied to the resource and user), not by guessing or pattern-matching URLs — tags must survive future changes to the URL shape.
A generic HTTP+cache client class owns fetching and caching mechanics only. It must have zero knowledge of "items," "users," or any other domain concept.
A separate service class holds the domain logic (what a "list" or "update" means) and is the only class allowed to know about the specific resource being fetched.
No class should do more than one job. No cache-invalidation logic duplicated across classes.

Testing requirements:

Use a mocked fetch implementation — no real network calls — so every test is deterministic.
Write a test that reproduces the original bug directly (a cache keyed by raw URL only, ignoring query params) and shows it returning the wrong user's data, to prove the bug is real and the fix matters.
Write tests covering: cache hit, cache miss, invalidation immediately after a mutation, and no cross-user leakage when two different userIds hit the same base URL.
All cache activity (hits, misses, invalidations, mutation timestamps) must be logged clearly enough that the fix is observable in test output, not just asserted silently.

Documentation requirements:

Every class and public method needs a clear doc comment explaining its purpose, parameters, and return shape.
Include a README covering: Overview, Setup & Running, Architecture & Design Choices (why cache keys are built this way, why invalidation is tag-based instead of URL-based), and Trade-offs & Future Work (e.g. what an ETag/304-based approach would add on top of this).

Non-negotiables: MVP first — get the core fetch-cache-invalidate flow working end-to-end before adding extras like ETag support. Handle errors gracefully; a failed network call must be caught, logged, and must not crash the caller. No hardcoded secrets. Small, atomic git commits with clear messages, not one large commit.