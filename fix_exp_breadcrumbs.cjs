const fs = require('fs');
let content = fs.readFileSync('src/ExperimentsPanel.tsx', 'utf-8');

if (!content.includes("useSentinel")) {
    content = content.replace(
        "import { Type } from '@google/genai';", 
        "import { Type } from '@google/genai';\nimport { useSentinel } from './SentinelContext';"
    );
}

const useEffectSnippet = `
  const { setBreadcrumbs } = useSentinel();
  React.useEffect(() => {
    const activeInfo = tabs.find(t => t.id === activeTab);
    if (activeInfo) {
      setBreadcrumbs([{ label: activeInfo.label }]);
    }
  }, [activeTab, setBreadcrumbs]);
`;

if (!content.includes("const activeInfo = tabs.find(t => t.id === activeTab);")) {
    content = content.replace(
        "const [activeTab, setActiveTab] = useState('morph');",
        "const [activeTab, setActiveTab] = useState('morph');\n" + useEffectSnippet
    );
}

fs.writeFileSync('src/ExperimentsPanel.tsx', content);
