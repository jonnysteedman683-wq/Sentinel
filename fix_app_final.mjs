import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Remove the old ones
content = content.replace(/[\s]*const \[isSynthPlaying, setIsSynthPlaying\] = useState\(false\);/g, "");
content = content.replace(/[\s]*const toggleSynth = \(\) => {[\s\S]*?};/g, "");

// 2. We need to add them before they are first used. 
// They are used at line 280 (inside useEffect) and 304. So they must be before line 280.
// Let's insert them right after `const sessionStartTime = useRef<number>(0);`
content = content.replace(
  "const sessionStartTime = useRef<number>(0);",
  "const sessionStartTime = useRef<number>(0);\n  const [isSynthPlaying, setIsSynthPlaying] = useState(false);\n  const toggleSynth = () => {\n    if (isSynthPlaying) {\n      ambientSynth.stop();\n      setIsSynthPlaying(false);\n    } else {\n      ambientSynth.start();\n      setIsSynthPlaying(true);\n    }\n  };"
);

fs.writeFileSync('src/App.tsx', content);
