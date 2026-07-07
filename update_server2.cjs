const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const oldCompletion = `const text = completion.choices[0].message.content || "";
        res.json({ text });`;

const newCompletion = `const text = completion.choices[0].message.content || "";
        res.json({ 
          text,
          provider: 'openai',
          usage: {
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0
          }
        });`;

const oldAnthropic = `const text = msg.content.map(c => c.type === 'text' ? c.text : '').join('');
        res.json({ text });`;

const newAnthropic = `const text = msg.content.map(c => c.type === 'text' ? c.text : '').join('');
        res.json({ 
          text,
          provider: 'anthropic',
          usage: {
            promptTokens: msg.usage?.input_tokens || 0,
            completionTokens: msg.usage?.output_tokens || 0,
            totalTokens: (msg.usage?.input_tokens || 0) + (msg.usage?.output_tokens || 0)
          }
        });`;

const oldGemini = `res.json({
          ...response,
          text: response.text
        });`;

const newGemini = `res.json({
          ...response,
          text: response.text,
          provider: 'google',
          usage: {
            promptTokens: response.usageMetadata?.promptTokenCount || 0,
            completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata?.totalTokenCount || 0
          }
        });`;

content = content.replace(oldCompletion, newCompletion);
content = content.replace(oldAnthropic, newAnthropic);
content = content.replace(oldGemini, newGemini);

fs.writeFileSync('server.ts', content);
