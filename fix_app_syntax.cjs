const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/typeof msg\.content === \\'string\\'/g, "typeof msg.content === 'string'");
content = content.replace(/JSON\.stringify\(msg\.content\) \|\| \\'\\'/g, "JSON.stringify(msg.content) || ''");
content = content.replace(/typeof msg\.selfAnalysis === \\'string\\'/g, "typeof msg.selfAnalysis === 'string'");

fs.writeFileSync('src/App.tsx', content);
console.log("App.tsx syntax fixed");
