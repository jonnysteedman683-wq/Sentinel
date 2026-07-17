const fs = require('fs');
let code = fs.readFileSync('src/lib/policy-network.ts', 'utf8');

code = code.replace(
  /    return \{\n      weights: serializedWeights,\n      updatedAt: Date\.now\(\),\n      inputSize: this\.stateDim,\n      outputSize: this\.actionDim\n    \};/,
  '    return {\n      weights: JSON.stringify(serializedWeights),\n      updatedAt: Date.now(),\n      inputSize: this.stateDim,\n      outputSize: this.actionDim\n    };'
);

code = code.replace(
  /deserialize\(data: SerializedPolicyNet\) \{/,
  'deserialize(data: SerializedPolicyNet) {\n    if (typeof data.weights === "string") { data.weights = JSON.parse(data.weights); }'
);

fs.writeFileSync('src/lib/policy-network.ts', code);
