const fs = require('fs');
let content = fs.readFileSync('src/ForgePanel.tsx', 'utf-8');

// Update processSingleTask signature
content = content.replace(
  /const processSingleTask = async \(taskPrompt: string, taskIndex: number, totalTasks: number\) => \{/,
  "const processSingleTask = async (taskPrompt: string, taskPriority: Priority, taskIndex: number, totalTasks: number) => {"
);

// Update selectAgent logic
const oldLogic = `      if (activeAgents.length > 0) {
        const sel = await selectAgent('forge_codegen', activeAgents.map(a => a.id));`;

const newLogic = `      if (activeAgents.length > 0) {
        let candidates = activeAgents.map(a => a.id);
        let strategy: 'thompson' | 'ucb1' = 'thompson';
        
        if (taskPriority === 'critical') {
          strategy = 'ucb1';
          const arms = await db.banditArms.where('taskType').equals('forge_codegen').toArray();
          const proven = arms.filter(a => a.pulls > 5).map(a => a.agentId);
          if (proven.length > 0) {
            candidates = candidates.filter(id => proven.includes(id));
          }
        } else if (taskPriority === 'low') {
          strategy = 'thompson';
        }
        
        const sel = await selectAgent('forge_codegen', candidates, strategy);`;

content = content.replace(oldLogic, newLogic);

// Update processSingleTask invocation
content = content.replace(
  /const result = await processSingleTask\(task\.prompt, i \+ 1, pendingTasks\.length\);/,
  "const result = await processSingleTask(task.prompt, task.priority, i + 1, pendingTasks.length);"
);

// Optional: change `priority: Priority` to `priority?: Priority` in `QueuedTask` just in case, though it's already there
content = content.replace(/priority: Priority;/, 'priority?: Priority;');

fs.writeFileSync('src/ForgePanel.tsx', content);
