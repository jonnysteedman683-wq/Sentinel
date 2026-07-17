const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/const isProd = process\.env\.NODE_ENV === "production";/g, 'const isProd = process.env.NODE_ENV === "production" || fs.existsSync(path.join(process.cwd(), "dist/index.html"));');
if (!code.includes("import fs from")) {
    code = 'import fs from "fs";\n' + code;
}
fs.writeFileSync('server.ts', code);
