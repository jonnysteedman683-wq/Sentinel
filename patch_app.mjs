import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Add Spark type import if needed
content = content.replace(
  "import KnowledgeGraphPanel from './components/KnowledgeGraphPanel.js';",
  "import KnowledgeGraphPanel, { Spark } from './components/KnowledgeGraphPanel.js';"
);

// Add sparks state
content = content.replace(
  'const [input, setInput] = useState("");',
  `const [input, setInput] = useState("");\n  const [sparks, setSparks] = useState<Spark[]>([]);\n  const [isRecording, setIsRecording] = useState(false);\n  const recognitionRef = useRef<any>(null);`
);

// Add start/stop recording functions
const recordingFunctions = `
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          handleSpeechFinal(finalTranscript);
        }
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const handleSpeechFinal = async (text: string) => {
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: \`Bearer \${token}\`
        },
        body: JSON.stringify({ text })
      });
      
      if (res.ok) {
        const data = await res.json();
        const newSpark: Spark = {
          id: Date.now().toString() + Math.random().toString(),
          text,
          embedding: data.embedding
        };
        setSparks(prev => [...prev, newSpark]);
      }
    } catch (err) {
      console.error("Failed to embed spark", err);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsRecording(true);
      } else {
        alert("Speech recognition is not supported in your browser.");
      }
    }
  };

  const handleSparkBind = async (spark: Spark) => {
    // Add the spark to memories
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      await fetch('/api/knowledge/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: \`Bearer \${token}\`
        },
        body: JSON.stringify({
          text: spark.text,
          source: 'voice_spark',
          metadata: { timestamp: Date.now() }
        })
      });
      
      setSparks(prev => prev.filter(s => s.id !== spark.id));
      fetchMemories();
    } catch (err) {
      console.error("Failed to bind spark to memory", err);
    }
  };
`;

content = content.replace(
  'const handleSend = async (e?: React.FormEvent) => {',
  `${recordingFunctions}\n\n  const handleSend = async (e?: React.FormEvent) => {`
);

// Update KnowledgeGraphPanel props
content = content.replace(
  '<KnowledgeGraphPanel memories={memories} />',
  '<KnowledgeGraphPanel memories={memories} sparks={sparks} onBindSpark={handleSparkBind} />'
);

// Update Mic button
content = content.replace(
  '<button type="button" className={`p-3 transition-colors ${theme === \'dark\' ? \'text-slate-400 hover:text-teal-400\' : \'text-slate-500 hover:text-teal-600\'}`}>',
  '<button type="button" onClick={toggleRecording} className={`p-3 transition-colors ${isRecording ? \'text-red-500 animate-pulse\' : (theme === \'dark\' ? \'text-slate-400 hover:text-teal-400\' : \'text-slate-500 hover:text-teal-600\')}`}>'
);

fs.writeFileSync('src/App.tsx', content);
