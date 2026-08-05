import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Add import
if (!content.includes('import { ambientSynth }')) {
  content = content.replace(
    "import { motion } from 'motion/react';",
    "import { motion } from 'motion/react';\nimport { ambientSynth } from './lib/audio-synth.js';"
  );
}

// Check where isSynthPlaying is declared
// We have:
//   const toggleSynth = () => { ... }
//   const handleTabChange = ...
// But where is the useState for isSynthPlaying?
// Let's find "const [isSidebarOpen, setSidebarOpen] = useState(true);"
// And find "const handleTabChange"

fs.writeFileSync('src/App.tsx', content);
