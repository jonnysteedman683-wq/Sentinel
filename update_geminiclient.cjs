const fs = require('fs');
let content = fs.readFileSync('src/geminiClient.ts', 'utf-8');

const oldReturn = `        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'API request failed');
        }
        return response.json();`;

const newReturn = `        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'API request failed');
        }
        const data = await response.json();
        if (data.usage) {
          window.dispatchEvent(new CustomEvent('ai-usage', { 
            detail: { provider: data.provider, usage: data.usage } 
          }));
        }
        return data;`;

content = content.replace(oldReturn, newReturn);
fs.writeFileSync('src/geminiClient.ts', content);
