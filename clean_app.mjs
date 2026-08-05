import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Fix duplicate Volume imports
content = content.replace(
  "import { Volume2, VolumeX, motion, AnimatePresence } from 'motion/react';",
  "import { motion, AnimatePresence } from 'motion/react';"
);

// Add ambientSynth import safely below React
content = content.replace(
  "import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';",
  "import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';\nimport { ambientSynth } from './lib/audio-synth.js';"
);

// We need to move the declaration of isSynthPlaying into the component:
// The component starts at "export default function App() {" or similar. Let's find "export default function App"
content = content.replace(
  "export default function App() {\n",
  "export default function App() {\n  const [isSynthPlaying, setIsSynthPlaying] = useState(false);\n"
);

// Then remove the old declaration if it exists
content = content.replace(
  "const [isSynthPlaying, setIsSynthPlaying] = useState(false);\n  const sessionStartTime = useRef<number>(0);",
  "const sessionStartTime = useRef<number>(0);"
);

// Make sure toggleSynth is inside App too. We can insert it right after the new isSynthPlaying declaration.
content = content.replace(
  "export default function App() {\n  const [isSynthPlaying, setIsSynthPlaying] = useState(false);\n",
  "export default function App() {\n  const [isSynthPlaying, setIsSynthPlaying] = useState(false);\n  const toggleSynth = () => {\n    if (isSynthPlaying) {\n      ambientSynth.stop();\n      setIsSynthPlaying(false);\n    } else {\n      ambientSynth.start();\n      setIsSynthPlaying(true);\n    }\n  };\n"
);

// Remove the old toggleSynth
content = content.replace(
  "const toggleSynth = () => {\n    if (isSynthPlaying) {\n      ambientSynth.stop();\n      setIsSynthPlaying(false);\n    } else {\n      ambientSynth.start();\n      setIsSynthPlaying(true);\n    }\n  };\n  const sessionStartTime = useRef<number>(0);",
  "const sessionStartTime = useRef<number>(0);"
);

fs.writeFileSync('src/App.tsx', content);
