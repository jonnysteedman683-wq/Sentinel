import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// remove current declarations
content = content.replace(/[\s]*const \[isSynthPlaying, setIsSynthPlaying\] = useState\(false\);/g, "");
content = content.replace(/[\s]*const toggleSynth = \(\) => {[\s\S]*?};/g, "");

// find App opening
content = content.replace(
  "export default function App() {\n",
  "export default function App() {\n  const [isSynthPlaying, setIsSynthPlaying] = useState(false);\n  const toggleSynth = () => {\n    if (isSynthPlaying) {\n      ambientSynth.stop();\n      setIsSynthPlaying(false);\n    } else {\n      ambientSynth.start();\n      setIsSynthPlaying(true);\n    }\n  };\n"
);

fs.writeFileSync('src/App.tsx', content);
