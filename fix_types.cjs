const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');
code = code.replace(/layers: \{\n    weights: number\[\]\[\];\n    biases: number\[\];\n  \}\[\];/, 'layers: { weights: string; biases: string; }[];');
fs.writeFileSync('src/types.ts', code);
