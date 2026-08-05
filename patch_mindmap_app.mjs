import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace MindMap usage
content = content.replace(
  "<MindMap memories={memories} theme={theme as any} />",
  "<MindMap memories={memories} theme={theme as any} sparks={sparks} onBindSpark={handleSparkBind} />"
);

// We also added an incorrect replacement of <KnowledgeGraphPanel> in patch_app.mjs:
// "<KnowledgeGraphPanel memories={memories} sparks={sparks} onBindSpark={handleSparkBind} />"
// We should remove this if it didn't match or clean it up.
// Actually, patch_app.mjs probably didn't find KnowledgeGraphPanel so it did nothing for that part.

fs.writeFileSync('src/App.tsx', content);
