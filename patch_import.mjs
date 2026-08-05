import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

if (!content.includes("import { Spark }")) {
  content = content.replace(
    "import { MindMap } from './components/MindMap.js';",
    "import { MindMap } from './components/MindMap.js';\nimport { Spark } from './components/KnowledgeGraphPanel.js';"
  );
}

fs.writeFileSync('src/App.tsx', content);
