const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');

// For BrainsTab
app = app.replace(/cognitiveMode=\{cognitiveMode\}\n/, '');
app = app.replace(/setCognitiveMode=\{setCognitiveMode\}\n/, '');
app = app.replace(/policyConfidence=\{policyConfidence\}\n/, '');
app = app.replace(/efeScore=\{efeScore\}\n/, '');
app = app.replace(/depth=\{depth\}\n/, '');
app = app.replace(/setDepth=\{setDepth\}\n/, '');
app = app.replace(/isDebateMode=\{isDebateMode\}\n/, '');
app = app.replace(/setIsDebateMode=\{setIsDebateMode\}\n/, '');

// For MemoryTab
app = app.replace(/theme=\{theme\}\n/, '');

fs.writeFileSync('src/App.tsx', app);
