const fs = require('fs');

const filesToFix = [
  'src/lib/circadian.ts',
  'src/lib/dream-engine.ts',
  'src/lib/events.ts',
  'src/lib/hebbian.ts',
  'src/lib/insightTrigger.ts',
  'src/lib/memory-lifecycle.ts',
  'src/types.ts'
];

for (const file of filesToFix) {
  let code = fs.readFileSync(file, 'utf8');
  if (code.includes('Timestamp')) {
    code = `import { Timestamp } from "firebase/firestore";\n` + code;
  }
  // add any types
  code = code.replace(/d =>/g, '(d: any) =>')
             .replace(/doc =>/g, '(doc: any) =>')
             .replace(/e =>/g, '(e: any) =>')
             .replace(/t =>/g, '(t: any) =>')
             .replace(/val, idx =>/g, '(val: any, idx: number) =>')
             .replace(/val, idx\)/g, '(val: any, idx: number)');
             
  fs.writeFileSync(file, code);
}
