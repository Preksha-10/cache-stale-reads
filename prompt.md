# Prompts Used

## Prompt 1
Debug a small data-fetch layer that returns stale results after mutations.
Users POST an update, then GET the list, but they still see old values
intermittently. Improve cache keys, invalidation, or ETag handling. Root
cause: GET responses were memoized by URL only, ignoring the userId query
param, causing cross-user leakage / stale lists after POST.

## Prompt 2
Implement with OOP design: an ICacheStore interface, tag-based cache
invalidation, ETag support, a CachedApiClient generic HTTP+cache layer,
and an ItemsService holding domain logic. Include a mocked fetch server
for tests. Add unit tests that reproduce the original bug and prove the fix.