const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const oldBlock = `      } else if (model.startsWith('claude-')) {`;
const newBlock = `      } else if (model.startsWith('openrouter/')) {
        const actualModel = model.replace('openrouter/', '');
        const openai = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY || 'dummy', baseURL: 'https://openrouter.ai/api/v1' });
        
        if (systemPrompt && messages[0]?.role !== 'system') {
           messages.unshift({ role: 'system', content: systemPrompt });
        }
        const completion = await openai.chat.completions.create({
          model: actualModel,
          messages,
          temperature: config?.temperature,
          response_format: config?.responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
        });
        
        const text = completion.choices[0].message.content || "";
        res.json({ 
          text,
          provider: 'openrouter',
          usage: {
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0
          }
        });
      } else if (model.startsWith('groq/')) {
        const actualModel = model.replace('groq/', '');
        const openai = new OpenAI({ apiKey: process.env.GROQ_API_KEY || 'dummy', baseURL: 'https://api.groq.com/openai/v1' });
        
        if (systemPrompt && messages[0]?.role !== 'system') {
           messages.unshift({ role: 'system', content: systemPrompt });
        }
        const completion = await openai.chat.completions.create({
          model: actualModel,
          messages,
          temperature: config?.temperature,
          response_format: config?.responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
        });
        
        const text = completion.choices[0].message.content || "";
        res.json({ 
          text,
          provider: 'groq',
          usage: {
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0
          }
        });
      } else if (model.startsWith('claude-')) {`;

content = content.replace(oldBlock, newBlock);
fs.writeFileSync('server.ts', content);
