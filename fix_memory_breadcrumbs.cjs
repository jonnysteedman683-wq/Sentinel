const fs = require('fs');
let content = fs.readFileSync('src/MemoryPanel.tsx', 'utf-8');

if (!content.includes("useSentinel")) {
    content = content.replace(
        "import { motion, AnimatePresence } from 'motion/react';", 
        "import { motion, AnimatePresence } from 'motion/react';\nimport { useSentinel } from './SentinelContext';"
    );
}

const useEffectSnippet = `
  const { setBreadcrumbs } = useSentinel();
  React.useEffect(() => {
    const tabLabels: Record<string, string> = {
      'episodic': 'EPISODIC LOGS',
      'semantic': 'SEMANTIC GRAPH',
      'graph': 'KNOWLEDGE NETWORK',
      'palace': 'MEMORY PALACE',
      'rewind': 'TEMPORAL REWIND',
      'stats': 'SYSTEM STATS',
      'heatmap': 'COGNITIVE HEATMAP'
    };
    setBreadcrumbs([{ label: tabLabels[tab] || tab.toUpperCase() }]);
  }, [tab, setBreadcrumbs]);
`;

if (!content.includes("const tabLabels: Record<string, string>")) {
    content = content.replace(
        "const [isConsolidating, setIsConsolidating] = useState(false);",
        "const [isConsolidating, setIsConsolidating] = useState(false);\n" + useEffectSnippet
    );
}

fs.writeFileSync('src/MemoryPanel.tsx', content);
