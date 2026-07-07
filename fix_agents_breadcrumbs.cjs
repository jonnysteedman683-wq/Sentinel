const fs = require('fs');
let content = fs.readFileSync('src/AgentsPanel.tsx', 'utf-8');

if (!content.includes("useSentinel")) {
    content = content.replace(
        "import { AgentRole, AgentProfile } from './types';", 
        "import { AgentRole, AgentProfile } from './types';\nimport { useSentinel } from './SentinelContext';"
    );
}

if (!content.includes("const { setBreadcrumbs } = useSentinel();")) {
    content = content.replace(
        "const [capInput, setCapInput] = useState('');",
        "const [capInput, setCapInput] = useState('');\n  const { setBreadcrumbs } = useSentinel();"
    );
}

const useEffectSnippet = `
  React.useEffect(() => {
    if (isAdding) {
      setBreadcrumbs([{ label: 'ADD NEW AGENT', onClick: () => setIsAdding(false) }]);
    } else if (selectedAgent) {
      setBreadcrumbs([{ label: selectedAgent.name, onClick: () => setSelectedAgentId(null) }]);
    } else {
      setBreadcrumbs([]);
    }
  }, [isAdding, selectedAgentId, selectedAgent?.name, setBreadcrumbs]);
`;

if (!content.includes("setBreadcrumbs([{ label: 'ADD NEW AGENT'")) {
    content = content.replace(
        "const handleAddAgent = async () => {",
        useEffectSnippet + "\n  const handleAddAgent = async () => {"
    );
}

fs.writeFileSync('src/AgentsPanel.tsx', content);
