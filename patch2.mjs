import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace state
content = content.replace(
  "const [input, setInput] = useState('');",
  "const [input, setInput] = useState('');\n  const [sparks, setSparks] = useState<Spark[]>([]);\n  const [isRecording, setIsRecording] = useState(false);\n  const recognitionRef = useRef<any>(null);"
);

content = content.replace(
  "const handleSparkBind = async (spark: Spark) => {",
  "const handleSparkBind = async (spark: Spark) => {"
);

fs.writeFileSync('src/App.tsx', content);
