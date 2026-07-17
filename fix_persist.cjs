const fs = require('fs');
let code = fs.readFileSync('src/lib/rl-persistence.ts', 'utf8');

code = code.replace(/weights: layer\.W\.map\(row => \[\.\.\.row\]\),\n    biases: layer\.b\[0\]\.map\(b => b\),/g, 'weights: JSON.stringify(layer.W),\n    biases: JSON.stringify(layer.b[0]),');

code = code.replace(/export function deserializeDense\(layer: Dense, serialized: \{ weights: number\[\]\[\], biases: number\[\] \}\) \{/g, 'export function deserializeDense(layer: Dense, serialized: { weights: string, biases: string }) {');

code = code.replace(/layer\.W = serialized\.weights\.map\(row => \[\.\.\.row\]\);\n  layer\.b = \[serialized\.biases\.map\(b => b\)\];/g, 'layer.W = JSON.parse(serialized.weights);\n  layer.b = [JSON.parse(serialized.biases)];');

fs.writeFileSync('src/lib/rl-persistence.ts', code);
