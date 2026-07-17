const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldRegex = /      \}\); else \{/g;
code = code.replace(oldRegex, `      });
      console.log("[Vite] Middleware initialized successfully.");
      app.use(vite.middlewares);
    } catch (e) {
      console.error("[Vite] Critical Failure during initialization:", e);
    }
  } else {`);

fs.writeFileSync('server.ts', code);
console.log('Fixed server.ts');
