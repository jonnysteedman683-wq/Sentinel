import fs from 'fs';

let content = fs.readFileSync('src/components/MindMap.tsx', 'utf-8');

// Add import for Spark if not present
content = content.replace(
  "import KnowledgeGraphPanel from './KnowledgeGraphPanel.js';",
  "import KnowledgeGraphPanel, { Spark } from './KnowledgeGraphPanel.js';"
);

// Update props
content = content.replace(
  "interface MindMapProps {\n  memories: any[];\n  theme?: 'dark' | 'light';\n}",
  "interface MindMapProps {\n  memories: any[];\n  theme?: 'dark' | 'light';\n  sparks?: Spark[];\n  onBindSpark?: (spark: Spark) => void;\n}"
);

// Update component signature
content = content.replace(
  "export const MindMap: React.FC<MindMapProps> = ({ memories, theme = 'dark' }) => {",
  "export const MindMap: React.FC<MindMapProps> = ({ memories, theme = 'dark', sparks, onBindSpark }) => {"
);

// Update KnowledgeGraphPanel usage
content = content.replace(
  "<KnowledgeGraphPanel memories={memories} />",
  "<KnowledgeGraphPanel memories={memories} sparks={sparks} onBindSpark={onBindSpark} />"
);

fs.writeFileSync('src/components/MindMap.tsx', content);
