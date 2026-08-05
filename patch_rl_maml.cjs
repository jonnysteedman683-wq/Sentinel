const fs = require('fs');
let content = fs.readFileSync('src/lib/rl-agent.ts', 'utf8');

if (!content.includes('import { syncMetaWeights }')) {
  content = content.replace("import { dbShim as db } from './firestore-shim.js';", "import { dbShim as db } from './firestore-shim.js';\nimport { syncMetaWeights } from './maml.js';");
}

const syncCall = `      await this.aiPlanner.savePolicyWeights();
      
      // Async trigger MAML parameter synchronization
      if (Math.random() < 0.1) { // 10% chance to contribute to meta-model
        syncMetaWeights(userId, docData).catch(err => console.error('MAML sync error:', err));
      }`;

if (!content.includes('syncMetaWeights(userId, docData)')) {
  content = content.replace(`      await this.aiPlanner.savePolicyWeights();`, syncCall);
}

fs.writeFileSync('src/lib/rl-agent.ts', content);
