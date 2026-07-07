const fs = require('fs');
let content = fs.readFileSync('src/ForgePanel.tsx', 'utf-8');

content = content.replace(
  /const processSingleTask = async \(taskPrompt: string, taskPriority: Priority, taskIndex: number, totalTasks: number\) => \{/,
  "const processSingleTask = async (taskPrompt: string, taskPriority: Priority | undefined, taskIndex: number, totalTasks: number) => {"
);

fs.writeFileSync('src/ForgePanel.tsx', content);
