# FIRESTORE INJECTION

## DOMAIN: FIRESTORE & DATA
1. Batched writes, idempotent operations (deterministic doc IDs where possible).
2. No unbounded listeners, always unsubscribe in cleanup.
3. Every Gemini-generated insight document stores its input hash, model version, and timestamp for reproducibility.
4. Server-only Gemini calls: structured JSON output enforced via prompt + parse-with-fallback. Strip markdown fences before JSON.parse.
