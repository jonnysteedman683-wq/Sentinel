const fs = require('fs');

let content = fs.readFileSync('src/components/KnowledgeGraphPanel.tsx', 'utf8');

// 1. Remove firebase imports
content = content.replace(/import \{ collection, query, limit, getDocs \} from 'firebase\/firestore';\n/, '');
content = content.replace(/import \{ db, auth \} from '\.\.\/firebase';\n/, '');

// 2. Add Memory interface and update props
content = content.replace(/export default function KnowledgeGraphPanel\(\) \{/, `
interface Memory {
  id: string;
  text: string;
  embedding?: number[];
}

interface KnowledgeGraphPanelProps {
  memories: Memory[];
}

export default function KnowledgeGraphPanel({ memories }: KnowledgeGraphPanelProps) {
`);

// 3. Optimize cosine calculation and logic in load
const loadFunctionReplacement = `
  const load = () => {
    setLoading(true);
    
    // 1. Filter memories to those with embeddings and map to raw format
    const raw = memories
      .filter(m => Array.isArray(m.embedding) && m.embedding.length > 0)
      .slice(0, MAX_DOCS);
    
    if (raw.length < 2) { 
      setNodes([]); 
      setEdges([]); 
      setLoading(false); 
      return; 
    }
    
    const embeddings = raw.map(r => r.embedding as number[]);
    const proj = pca2D(embeddings);
    const clusters = sphericalKMeans(embeddings, Math.min(8, Math.max(3, Math.floor(raw.length / 5))));
    const xs = proj.map(p => p[0]), ys = proj.map(p => p[1]);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    
    const newNodes: KBNode[] = raw.map((r, i) => {
      const px = 40 + ((proj[i][0] - x0) / (x1 - x0 + 1e-9)) * 520;
      const py = 40 + ((proj[i][1] - y0) / (y1 - y0 + 1e-9)) * 320;
      return { 
        id: r.id,
        text: r.text,
        source: 'memory',
        embedding: embeddings[i],
        cluster: clusters[i],
        px_init: px,
        py_init: py,
        x: px, 
        y: py 
      };
    });
    
    // Optimized cosine similarity calculation
    const newEdges: Edge[] = [];
    const norms = embeddings.map(v => {
      let n = 0;
      for (let i = 0; i < v.length; i++) n += v[i] * v[i];
      return Math.sqrt(n) + 1e-9;
    });

    for (let i = 0; i < newNodes.length; i++) {
      const ei = embeddings[i];
      const ni = norms[i];
      for (let j = i + 1; j < newNodes.length; j++) {
        const ej = embeddings[j];
        const nj = norms[j];
        let dot = 0;
        for (let k = 0; k < ei.length; k++) {
          dot += ei[k] * ej[k];
        }
        const s = dot / (ni * nj);
        if (s >= SIM_THRESHOLD) {
          newEdges.push({ source: newNodes[i].id, target: newNodes[j].id, sim: s });
        }
      }
    }
    
    setNodes(newNodes);
    setEdges(newEdges);
    setLoading(false);
  };
`;

content = content.replace(/const load = async \(\) => \{[\s\S]*?setLoading\(false\);\n  \};/, loadFunctionReplacement.trim());
content = content.replace(/useEffect\(\(\) => \{ load\(\); \}, \[\]\);/, 'useEffect(() => { load(); }, [memories]);');

fs.writeFileSync('src/components/KnowledgeGraphPanel.tsx', content);
