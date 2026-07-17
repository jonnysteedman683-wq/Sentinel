const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Remove the import from inside the function
code = code.replace('import { withResilience, asyncHandler } from "./src/lib/express-resilience";', '');

// Add it to the top
if (!code.includes('import { withResilience, asyncHandler }')) {
    code = 'import { withResilience, asyncHandler } from "./src/lib/express-resilience";\n' + code;
}

fs.writeFileSync('server.ts', code);
