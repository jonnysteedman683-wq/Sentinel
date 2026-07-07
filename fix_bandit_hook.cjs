const fs = require('fs');
let content = fs.readFileSync('src/BanditPanel.tsx', 'utf-8');

// Fix 1: agents?.map
content = content.replace(
  /return selectAgent\(agents\.map\(\(a: any\) => a\.id\), taskType\);/,
  "if (!agents) return;\n    return selectAgent(agents.map((a: any) => a.id), taskType);"
);

fs.writeFileSync('src/BanditPanel.tsx', content);
