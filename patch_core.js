const fs = require('fs');

const file = 'src/lib/rl-agent-core.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('setUseActiveInference')) {
  code = code.replace(
    'train() {',
    `setUseActiveInference(value: boolean) {
    this.useActiveInference = value;
  }
  
  train() {`
  );
  fs.writeFileSync(file, code);
}
