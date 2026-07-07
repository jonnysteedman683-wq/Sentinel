const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Remove the effect
content = content.replace(
`  useEffect(() => {
    setBreadcrumbs([]);
  }, [activeTab, setBreadcrumbs]);`,
  ``
);

// Update setActiveTab usage in tab buttons
content = content.replace(
  /onClick=\{\(\) => setActiveTab\(t\.id as Tab\)\}/g,
  "onClick={() => { setActiveTab(t.id as Tab); setBreadcrumbs([]); }}"
);

fs.writeFileSync('src/App.tsx', content);
