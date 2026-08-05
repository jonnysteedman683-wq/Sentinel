import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Move useState
content = content.replace(
  "const [isSynthPlaying, setIsSynthPlaying] = useState(false);",
  ""
);

content = content.replace(
  "const sessionStartTime = useRef<number>(0);",
  "const [isSynthPlaying, setIsSynthPlaying] = useState(false);\n  const sessionStartTime = useRef<number>(0);"
);

// Move toggleSynth
content = content.replace(
  /[\s]*const toggleSynth = \(\) => {[\s\S]*?};/,
  ""
);

content = content.replace(
  "const sessionStartTime = useRef<number>(0);",
  "const toggleSynth = () => {\n    if (isSynthPlaying) {\n      ambientSynth.stop();\n      setIsSynthPlaying(false);\n    } else {\n      ambientSynth.start();\n      setIsSynthPlaying(true);\n    }\n  };\n  const sessionStartTime = useRef<number>(0);"
);

fs.writeFileSync('src/App.tsx', content);
