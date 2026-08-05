# Domain: Firestore & Data Persistence

## 1. Shim & Fallback Architecture
- Always import Firestore functions from `firebase/firestore`.
- Use the `firestore-shim.ts` pattern to gracefully handle quota-exceeded errors (`resource-exhausted`).
- When offline or rate-limited, failover to local memory or Dexie transparently.

## 2. Operation Discipline
- **Batched Writes:** Use batched writes for inserting trajectories, metrics, or multi-doc updates.
- **Idempotency:** Ensure deterministic doc IDs (e.g. hashing states or using canonical timestamps) where possible to prevent duplicate documents on retries.
- **Listeners:** No unbounded listeners. Always unsubscribe in cleanup `useEffect`.

## 3. Data Schemas
- Types strictly enforced in `src/types.ts`. 
- No loose `any` typing when fetching from Firestore.

## 4. Insight Lineage
- Every Gemini-generated insight document MUST store its input hash, model version, and timestamp for reproducibility.
