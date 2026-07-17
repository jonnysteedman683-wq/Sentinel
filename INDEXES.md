# Firestore Composite Indexes Requirement

To support production queries for memory nudging, retrieval, and recency sorting, the following Firestore composite indexes must be configured in your Firebase project.

## Index 1: Pinned Strength Selection
This index is required for querying pinned memories sorted by their neural strength.

- **Collection ID**: `memories` (Query scope: `Collection`)
- **Fields**:
  - `pinned` (Ascending)
  - `strength` (Descending)

---

## Index 2: Memory Freshness Bias (Dynamic Recency Decay Selection)
This index is required for filtering memory collections and sorting by least-recently-nudged state to prioritize freshness and avoid repetitive interactions.

- **Collection ID**: `memories` (Query scope: `Collection`)
- **Fields**:
  - `pinned` (Ascending)
  - `lastNudged` (Ascending)
