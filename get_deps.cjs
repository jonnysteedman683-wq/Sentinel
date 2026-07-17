const fs = require('fs');
const content = fs.readFileSync('src/components/tabs/BrainsTab_temp.tsx', 'utf8');

const regex = /\b(set[A-Z]\w+|handle[A-Z]\w+|is[A-Z]\w+|[a-z]\w*)\b/g;
const words = new Set(content.match(regex));
// This is not perfect, we'll just extract the props manually.
