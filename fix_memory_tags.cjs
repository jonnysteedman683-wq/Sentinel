const fs = require('fs');

let tab = fs.readFileSync('src/components/tabs/MemoryTab.tsx', 'utf8');
tab = tab.replace(/allMemoryTags: string\[\];\n/, '');
tab = tab.replace(/selectedTagFilter, setSelectedTagFilter, allMemoryTags,/, 'selectedTagFilter, setSelectedTagFilter,');
fs.writeFileSync('src/components/tabs/MemoryTab.tsx', tab);

let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(/allMemoryTags=\{allMemoryTags\}\n/g, '');
fs.writeFileSync('src/App.tsx', app);
