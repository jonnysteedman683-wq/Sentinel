const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(
  /toggleSkill=\{toggleSkill\}/,
  "toggleSkill={toggleSkill}\n                depth={depth}\n                setDepth={setDepth}"
);

fs.writeFileSync('src/App.tsx', app);
