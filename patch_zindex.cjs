const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
`          <InsightReveal 
            insight={activeInsight}
            onSave={handleSaveInsight}
            onDismiss={handleDismissInsight}
            onTimeout={handleInsightTimeout}
          />
          <InsightFeed onReward={(r) => rlAgent.current?.applyDelayedInsightReward(r)} />
            </div>`,
`            </div>
          <InsightReveal 
            insight={activeInsight}
            onSave={handleSaveInsight}
            onDismiss={handleDismissInsight}
            onTimeout={handleInsightTimeout}
          />
          <InsightFeed onReward={(r) => rlAgent.current?.applyDelayedInsightReward(r)} />`
);
fs.writeFileSync('src/App.tsx', code);
