const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes("import { runPredictivePrefetch }")) {
  content = content.replace("import { CuriousAgent } from './lib/rl-agent.js';", "import { CuriousAgent } from './lib/rl-agent.js';\nimport { runPredictivePrefetch } from './lib/predictive-prefetch.js';");
}

const triggerCode = `          const decision = await agent.selectActionHRL(state);
          
          // Trigger neuro-caching predictive prefetch asynchronously
          runPredictivePrefetch(user.uid, agent).catch(console.error);`;

if (!content.includes('runPredictivePrefetch(user.uid, agent)')) {
  content = content.replace(`          const decision = await agent.selectActionHRL(state);`, triggerCode);
}

fs.writeFileSync('src/App.tsx', content);
