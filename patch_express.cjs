const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

if (!code.includes('applyResilience(')) {
    const patch = `
import { withResilience, asyncHandler } from "./src/lib/express-resilience";

function applyResilience(app: express.Application) {
  const methods = ['get', 'post', 'put', 'delete'] as const;
  methods.forEach(method => {
    const original = app[method].bind(app);
    (app as any)[method] = (path: any, ...handlers: any[]) => {
      if (typeof path === 'string' && path.startsWith('/api/')) {
        const lastHandler = handlers.pop();
        if (typeof lastHandler === 'function') {
           // We wrap the final handler in our resilience wrapper
           const wrapped = withResilience(path, asyncHandler(lastHandler));
           handlers.push(wrapped);
        } else {
           handlers.push(lastHandler);
        }
      }
      return original(path, ...handlers);
    };
  });
}
`;

    code = code.replace(
      'const app = express();',
      patch + '\n  const app = express();\n  applyResilience(app);'
    );
    
    fs.writeFileSync('server.ts', code);
}
