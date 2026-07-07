export const getGeminiClient = () => {
  return {
    models: {
      generateContent: async (params: any) => {
        const response = await fetch('/api/gemini/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'API request failed');
        }
        const data = await response.json();
        if (data.usage) {
          window.dispatchEvent(new CustomEvent('ai-usage', { 
            detail: { provider: data.provider, usage: data.usage } 
          }));
        }
        return data;
      },
      embedContent: async (params: any) => {
        const response = await fetch('/api/gemini/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'API request failed');
        }
        return response.json();
      }
    }
  };
};
