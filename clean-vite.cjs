const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const badCode = `      console.log("[Vite] Middleware initialized successfully.");
      app.use(vite.middlewares);
    } catch (e) {
      console.error("[Vite] Critical Failure during initialization:", e);
    }
  }`;

code = code.replace(badCode, '');
fs.writeFileSync('server.ts', code);
console.log('Cleaned up garbage.');
