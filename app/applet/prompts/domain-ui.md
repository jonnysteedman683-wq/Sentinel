# Domain: User Interface & Dashboards

## 1. Canvas & SVG Rendering
- Render heavy metric data progressively using canvas or SVG panels. 
- Never block the main thread on full datasets.
- Component unmounting MUST cancel active requestAnimationFrames and clear contexts.

## 2. Styling
- Tailwind CSS exclusively.
- Use explicit, dark-themed palettes matching the AQB "Cosmic" or "Tech" aesthetic (zinc-900 backgrounds, high-contrast neon accents).
- Do not introduce UI slop (no unnecessary terminal loading logs in the UI, unless specifically part of the "vitals" telemetry dashboard).

## 3. Async Boundaries
- All UI components depending on async ML evaluation or Firestore reads MUST implement `<ErrorBoundary>` or local try/catch with gracefully styled error states.
- Always provide immediate visual feedback (e.g., Skeleton loaders) while background processing is occurring.
