# UI PANELS INJECTION

## DOMAIN: PROGRESSIVE RENDERING & CANVAS
1. Progressive rendering: canvas/SVG panels render partial data immediately; never block on full dataset.
2. Canvas scaling: Use `ResizeObserver` on a container element to dynamically adjust dimensions instead of static innerWidth/innerHeight. Debounce resize observer updates.
3. Metric normalization: Always normalize multi-metric views using independent min/max ranges (0-100 scale).
