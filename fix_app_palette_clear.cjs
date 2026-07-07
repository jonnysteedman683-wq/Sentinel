const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  "onSelect: () => setActiveTab(t.id as Tab)",
  "onSelect: () => { setActiveTab(t.id as Tab); setBreadcrumbs([]); }"
);

fs.writeFileSync('src/App.tsx', content);
