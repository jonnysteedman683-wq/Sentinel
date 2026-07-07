const fs = require('fs');
let content = fs.readFileSync('src/SkillsPanel.tsx', 'utf-8');

if (!content.includes("useSentinel")) {
    content = content.replace(
        "import { SkillCard } from './types';", 
        "import { SkillCard } from './types';\nimport { useSentinel } from './SentinelContext';"
    );
}

const useEffectSnippet = `
  const { setBreadcrumbs } = useSentinel();
  React.useEffect(() => {
    if (selectedSkill) {
      setBreadcrumbs([{ label: selectedSkill.name, onClick: () => setSelectedSkillId(null) }]);
    } else {
      setBreadcrumbs([]);
    }
  }, [selectedSkill?.name, setBreadcrumbs]);
`;

if (!content.includes("setBreadcrumbs([{ label: selectedSkill.name")) {
    content = content.replace(
        "const rootSkills = skills?.filter(s => !s.parentId && !s.upgradesFromId) || [];",
        "const rootSkills = skills?.filter(s => !s.parentId && !s.upgradesFromId) || [];\n" + useEffectSnippet
    );
}

fs.writeFileSync('src/SkillsPanel.tsx', content);
