const fs = require('fs');

// 1. Add theme to LandingScreen in App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(
  /<LandingScreen \n\s*onEnter=\{/,
  '<LandingScreen \n        theme={theme}\n        onEnter=\{'
);

// 2. Remove theme={theme} from MemoryTab in App.tsx
app = app.replace(/\s*theme=\{theme\}\n/, '\n');

fs.writeFileSync('src/App.tsx', app);

// 3. Add depth to BrainsTabProps
let brains = fs.readFileSync('src/components/tabs/BrainsTab.tsx', 'utf8');
brains = brains.replace(
  /export interface BrainsTabProps \{/,
  "export interface BrainsTabProps {\n  depth: string;\n  setDepth: (d: any) => void;"
);
brains = brains.replace(
  /isDebateMode, setIsDebateMode, addLog, modelState, skills, toggleSkill/,
  "isDebateMode, setIsDebateMode, addLog, modelState, skills, toggleSkill, depth, setDepth"
);
fs.writeFileSync('src/components/tabs/BrainsTab.tsx', brains);
