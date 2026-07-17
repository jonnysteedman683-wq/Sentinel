const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');
code = code.replace(/import \{ Timestamp \} from 'firebase-admin\/firestore';/, '');
fs.writeFileSync('src/types.ts', code);
