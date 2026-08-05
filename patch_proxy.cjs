const fs = require('fs');

const file = 'src/lib/rl-agent.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'public useActiveInference: boolean = false;',
  `private _useActiveInference: boolean = false;
  get useActiveInference(): boolean { return this._useActiveInference; }
  set useActiveInference(value: boolean) {
    this._useActiveInference = value;
    this.postMessageAsync('setUseActiveInference', [value]).catch(console.error);
  }`
);

code = code.replace(
  'this.useActiveInference = e.data.data.useActiveInference;',
  'this._useActiveInference = e.data.data.useActiveInference;'
);

fs.writeFileSync(file, code);
