const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = 'process.env.TF_ENABLE_ONEDNN_OPTS = "0";\n' + code;
fs.writeFileSync('server.ts', code);
