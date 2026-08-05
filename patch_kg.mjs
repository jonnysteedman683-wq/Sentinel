import fs from 'fs';

let content = fs.readFileSync('src/components/KnowledgeGraphPanel.tsx', 'utf-8');

// Add Spark types and modify props
content = content.replace('interface Memory {', `export interface Spark {\n  id: string;\n  text: string;\n  embedding: number[];\n}\n\ninterface Memory {`);

content = content.replace(
  'interface KnowledgeGraphPanelProps {\n  memories: Memory[];\n}',
  `interface KnowledgeGraphPanelProps {\n  memories: Memory[];\n  sparks?: Spark[];\n  onBindSpark?: (spark: Spark) => void;\n}`
);

// Add visual sparks ref
content = content.replace(
  'const [dimensions, setDimensions] = useState({ width: 600, height: 400 });',
  `const [dimensions, setDimensions] = useState({ width: 600, height: 400 });\n  const visualSparksRef = useRef<any[]>([]);`
);

// Add sparks effect
const sparksEffect = `
  useEffect(() => {
    if (!sparks || sparks.length === 0 || nodes.length === 0) return;
    
    // Find newly added sparks
    const currentSparkIds = new Set(visualSparksRef.current.map(s => s.spark.id));
    const newSparks = sparks.filter(s => !currentSparkIds.has(s.id));
    
    newSparks.forEach(spark => {
      // Find closest node
      let bestNode = nodes[0];
      let bestSim = -Infinity;
      
      const sEmb = spark.embedding;
      const sNorm = Math.sqrt(sEmb.reduce((a, b) => a + b * b, 0)) + 1e-9;
      
      for (const n of nodes) {
        const nEmb = n.embedding;
        const nNorm = Math.sqrt(nEmb.reduce((a, b) => a + b * b, 0)) + 1e-9;
        let dot = 0;
        for (let i = 0; i < sEmb.length; i++) dot += sEmb[i] * nEmb[i];
        const sim = dot / (sNorm * nNorm);
        if (sim > bestSim) {
          bestSim = sim;
          bestNode = n;
        }
      }
      
      // Start from random edge
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.max(dimensions.width, dimensions.height);
      const startX = dimensions.width / 2 + Math.cos(angle) * radius;
      const startY = dimensions.height / 2 + Math.sin(angle) * radius;
      
      visualSparksRef.current.push({
        spark,
        x: startX,
        y: startY,
        targetNode: bestNode,
        color: COLORS[bestNode.cluster % COLORS.length] || '#ec4899',
        bound: false
      });
    });
  }, [sparks, nodes, dimensions]);
`;

content = content.replace(
  'useEffect(() => { load(); }, [memories]);',
  `useEffect(() => { load(); }, [memories]);\n${sparksEffect}`
);

// Update tick function to draw sparks
const sparkDraw = `
        // sparks
        const sparksToRemove = new Set<string>();
        for (const s of visualSparksRef.current) {
          if (s.bound) continue;
          
          const tx = s.targetNode.x || dimensions.width / 2;
          const ty = s.targetNode.y || dimensions.height / 2;
          
          s.x += (tx - s.x) * 0.08;
          s.y += (ty - s.y) * 0.08;
          
          const dist = Math.sqrt((tx - s.x) ** 2 + (ty - s.y) ** 2);
          if (dist < 10) {
            s.bound = true;
            sparksToRemove.add(s.spark.id);
            if (onBindSpark) onBindSpark(s.spark);
          }
          
          ctx.shadowColor = s.color;
          ctx.shadowBlur = 15;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        
        if (sparksToRemove.size > 0) {
          visualSparksRef.current = visualSparksRef.current.filter(s => !sparksToRemove.has(s.spark.id));
        }
`;

content = content.replace(
  '// nodes',
  `${sparkDraw}\n        // nodes`
);

content = content.replace(
  'export default function KnowledgeGraphPanel({ memories }: KnowledgeGraphPanelProps) {',
  'export default function KnowledgeGraphPanel({ memories, sparks, onBindSpark }: KnowledgeGraphPanelProps) {'
);

fs.writeFileSync('src/components/KnowledgeGraphPanel.tsx', content);
