const fs = require('fs');
let file = fs.readFileSync('src/components/tabs/BrainsTab.tsx', 'utf8');

file = file.replace(
  /addLog, modelState, skills, toggleSkill/,
  "addLog, modelState, skills, toggleSkill, depth, setDepth"
);
fs.writeFileSync('src/components/tabs/BrainsTab.tsx', file);
