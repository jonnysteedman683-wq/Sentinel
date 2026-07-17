const fs = require('fs');
let code = fs.readFileSync('src/lib/policy-network.ts', 'utf8');

code = code.replace(
  /deserialize\(data: SerializedPolicyNet\) \{\n    if \(typeof data.weights === "string"\) \{ data.weights = JSON.parse\(data.weights\); \}\n    const tensors = data\.weights\.map\(w => tf\.tensor\(w\)\);/g,
  'deserialize(data: SerializedPolicyNet) {\n    let parsedWeights: any[] = typeof data.weights === "string" ? JSON.parse(data.weights) : data.weights;\n    const tensors = parsedWeights.map((w: any) => tf.tensor(w));'
);

fs.writeFileSync('src/lib/policy-network.ts', code);
