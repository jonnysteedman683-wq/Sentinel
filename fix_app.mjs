import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Fix motion import
content = content.replace(
  "import { Volume2, VolumeX, motion } from 'motion/react';",
  "import { motion } from 'motion/react';"
);

// Add Volume to lucide-react import
content = content.replace(
  "Compass, Plus, Edit2, History } from 'lucide-react';",
  "Compass, Plus, Edit2, History, Volume2, VolumeX } from 'lucide-react';"
);

// Also let's check where the state and toggleSynth are declared
// We need them to be inside the App component, and before they are used.

fs.writeFileSync('src/App.tsx', content);
