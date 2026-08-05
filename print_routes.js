import express from 'express';
import { withResilience, asyncHandler } from "./dist/src/lib/express-resilience.js";

const app = express();
// Simulate applyResilience
const methods = ['get', 'post', 'put', 'delete'];
methods.forEach(method => {
  const original = app[method].bind(app);
  app[method] = (path, ...handlers) => {
    if (typeof path === 'string' && path.startsWith('/api/')) {
      const lastHandler = handlers.pop();
      if (typeof lastHandler === 'function') { 
         const wrapped = withResilience(path, asyncHandler(lastHandler));
         handlers.push(wrapped);
      } else {
         handlers.push(lastHandler);
      }
    }
    return original(path, ...handlers);
  };
});

app.post('/api/generate-insight', (req, res) => res.json({}));
console.log(app._router.stack.filter(l => l.route).map(l => l.route.path));
