const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  "{tabGroups.find(g => g.tabs.some(t => t.id === activeTab))?.tabs.find(t => t.id === activeTab)?.label || 'NEXUS'}",
  "{tabGroups.map(g => g.tabs).flat().find((t: any) => t.id === activeTab)?.label || 'NEXUS'}"
);

fs.writeFileSync('src/App.tsx', content);
