#!/bin/bash
sed -i '/\/\/ Centralized Error-Handling Middleware/i \
  app.use((req, res, next) => {\
    if (req.url.startsWith("/api/")) {\
      console.error(`[404 Fallback] Unmatched API Route: ${req.method} ${req.url}`);\
      return res.status(404).json({ error: "Route not found: " + req.method + " " + req.url });\
    }\
    next();\
  });\
' server.ts
