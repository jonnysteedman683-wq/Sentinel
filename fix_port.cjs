const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  /const PORT = process\.env\.PORT \? parseInt\(process\.env\.PORT, 10\) : 3000;/,
  'const PORT = 3000;'
);
fs.writeFileSync('server.ts', code);
