const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');
code = code.replace(/export interface SerializedPolicyNet \{\n  weights: any\[\];/g, 'export interface SerializedPolicyNet {\n  weights: string;');
fs.writeFileSync('src/types.ts', code);
