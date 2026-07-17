const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

app = app.replace(
  /addLog=\{addLog\}/,
  "addLog={addLog}\n                modelState={modelState}\n                skills={skills}\n                toggleSkill={toggleSkill}"
);

// Remove unused from App.tsx
app = app.replace(/import \{ PersonaForm \} from '\.\/components\/PersonaForm';\n/, '');

fs.writeFileSync('src/App.tsx', app);
