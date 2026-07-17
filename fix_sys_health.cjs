const fs = require('fs');
let code = fs.readFileSync('src/lib/system-health-model.ts', 'utf8');

code = code.replace(
  /const weights = this\.model\.getWeights\(\)\.map\(w => Array\.from\(w\.dataSync\(\)\)\);/,
  'const weights = JSON.stringify(this.model.getWeights().map(w => Array.from(w.dataSync())));'
);

code = code.replace(
  /if \(weightsData && Array\.isArray\(weightsData\.weights\)\) \{/,
  `if (weightsData && typeof weightsData.weights === 'string') {`
);

code = code.replace(
  /const tensors = weightsData\.weights\.map\(\(w: any, i: number\) => \{/,
  `const parsedWeights = JSON.parse(weightsData.weights);\n        const tensors = parsedWeights.map((w: any, i: number) => {`
);

fs.writeFileSync('src/lib/system-health-model.ts', code);
