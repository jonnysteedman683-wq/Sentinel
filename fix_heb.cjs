const fs = require('fs');
let code = fs.readFileSync('src/lib/hebbian.ts', 'utf8');
code = code.replace(/m1\.embedding\.map\(\(\(val: any, idx: number\) => \(val \+ m2\.embedding\[idx\]\) \/ 2\),/g, "m1.embedding.map((val: any, idx: number) => (val + m2.embedding[idx]) / 2),");
fs.writeFileSync('src/lib/hebbian.ts', code);
