import { readFileSync, writeFileSync } from 'fs';

// Remove the biome-ignore that biome is complaining about being malformed
let chatContent = readFileSync('src/components/tabs/ChatTab.tsx', 'utf-8');
chatContent = chatContent.replace('// biome-ignore lint/correctness/noUnusedImports:\n// biome-ignore lint/nursery/useSortedClasses:\n// biome-ignore format:\n', '');
writeFileSync('src/components/tabs/ChatTab.tsx', chatContent);

let appContent = readFileSync('src/App.tsx', 'utf-8');
appContent = appContent.replace('// biome-ignore lint/correctness/noUnusedImports:\n// biome-ignore lint/nursery/useSortedClasses:\n// biome-ignore format:\n', '');

// Add type="button" to the buttons that biome found in App.tsx
appContent = appContent.replace(
  '<button\n                onClick={() => handleTabChange(\'Chat\')}',
  '<button type="button"\n                onClick={() => handleTabChange(\'Chat\')}'
);
appContent = appContent.replace(
  '<button\n                onClick={() => handleTabChange(\'Memory\')}',
  '<button type="button"\n                onClick={() => handleTabChange(\'Memory\')}'
);
appContent = appContent.replace(
  '<button\n                onClick={() => handleTabChange(\'Identity\')}',
  '<button type="button"\n                onClick={() => handleTabChange(\'Identity\')}'
);
appContent = appContent.replace(
  '<button\n                onClick={() => handleTabChange(\'Goals\')}',
  '<button type="button"\n                onClick={() => handleTabChange(\'Goals\')}'
);
appContent = appContent.replace(
  '<button\n                onClick={() => handleTabChange(\'Diagnostics\')}',
  '<button type="button"\n                onClick={() => handleTabChange(\'Diagnostics\')}'
);
appContent = appContent.replace(
  '<button\n                onClick={() => handleTabChange(\'Swarm\')}',
  '<button type="button"\n                onClick={() => handleTabChange(\'Swarm\')}'
);
appContent = appContent.replace(
  '<button\n                onClick={() => handleTabChange(\'Dream Cinema\')}',
  '<button type="button"\n                onClick={() => handleTabChange(\'Dream Cinema\')}'
);
appContent = appContent.replace(
  '<button\n                onClick={() => handleTabChange(\'Sandbox\')}',
  '<button type="button"\n                onClick={() => handleTabChange(\'Sandbox\')}'
);
appContent = appContent.replace(
  '<button\n                onClick={() => handleTabChange(\'Brains\')}',
  '<button type="button"\n                onClick={() => handleTabChange(\'Brains\')}'
);

writeFileSync('src/App.tsx', appContent);
