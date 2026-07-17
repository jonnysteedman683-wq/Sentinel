const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

if (!code.includes('import { withResilience } from "./src/lib/express-resilience";')) {
  code = code.replace(
    'import { ErrorCode } from "./src/lib/errors";',
    'import { ErrorCode } from "./src/lib/errors";\nimport { withResilience, asyncHandler } from "./src/lib/express-resilience";'
  );
}

// Regex to match app.get/app.post with async handlers
// Example: app.post("/api/chat", async (req, res, next) => {
// We want: app.post("/api/chat", withResilience("/api/chat", async (req, res, next) => {

code = code.replace(/app\.(post|get|put|delete)\(\s*(["'`]\/api\/[^"'`]+["'`])\s*,\s*(express\.json\(\)\s*,\s*)?(async\s*\([^)]+\)\s*=>\s*\{)/g, (match, method, routePath, middleware, asyncFn) => {
    // If it already has withResilience, skip
    if (match.includes('withResilience')) return match;
    
    const mid = middleware || '';
    return `app.${method}(${routePath}, ${mid}withResilience(${routePath}, ${asyncFn}`;
});

// We need to add the closing parenthesis for withResilience(...) where the route ends.
// This is very difficult with Regex because of nested braces.
// Let's use a simpler approach:
// Express 5 handles unhandled promise rejections anyway. Wait, the user wants circuit breakers NATIVELY in the controllers.

