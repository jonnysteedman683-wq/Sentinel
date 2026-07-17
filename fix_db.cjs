const fs = require('fs');
const glob = require('glob');
const path = require('path');

function replaceInFiles() {
  const files = ['src/lib/insightTrigger.ts', 'src/lib/dream-engine.ts', 'src/lib/affectiveFeedback.ts', 'src/lib/hebbian.ts', 'src/lib/events.ts', 'src/lib/memory-reinforce.ts', 'src/lib/circadian.ts', 'src/lib/memory-lifecycle.ts'];
  
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let code = fs.readFileSync(file, 'utf8');
    // Replace import
    code = code.replace(/import \{ getFirestore(?:, Timestamp)? \} from 'firebase-admin\/firestore';/, 'import { dbShim as db } from "./firestore-shim";');
    code = code.replace(/import \{ getFirestore \} from 'firebase-admin\/firestore';/, 'import { dbShim as db } from "./firestore-shim";');
    
    // Replace const db = getFirestore(); with nothing since it's imported as db
    code = code.replace(/const db = getFirestore\(\);/g, '');
    code = code.replace(/getFirestore\(\)\./g, 'db.');
    
    fs.writeFileSync(file, code);
  }
}

replaceInFiles();
