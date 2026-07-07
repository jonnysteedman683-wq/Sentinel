import { useState, useEffect, useRef } from 'react';
import { getGeminiClient } from '../geminiClient';

export interface CognitiveAnalysis {
  sentiment: string;
  distortions: string[];
  reframing: string;
}

export function useCognitiveMirror(input: string) {
  const [analysis, setAnalysis] = useState<CognitiveAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const aiClientRef = useRef<any>(null);

  useEffect(() => {
    aiClientRef.current = getGeminiClient();
  }, []);

  useEffect(() => {
    if (input.length < 20) {
      setAnalysis(null);
      return;
    }

    const timer = setTimeout(async () => {
      if (!aiClientRef.current) return;
      setIsAnalyzing(true);
      try {
        const prompt = `Analyze the following draft text for cognitive distortions (like all-or-nothing thinking, catastrophizing), emotional tone, and hidden sentiment. Provide a brief "Empathic Mirror" response. 
        Return ONLY valid JSON.
        Format strictly as: {"sentiment": "brief description", "distortions": ["distortion1"], "reframing": "a gentle Socratic question"}
        Draft text to analyze: "${input}"`;

        const response = await aiClientRef.current.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        
        const match = response.text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as CognitiveAnalysis;
          setAnalysis(parsed);
        }
      } catch (err) {
        console.error("Cognitive mirror error:", err);
      } finally {
        setIsAnalyzing(false);
      }
    }, 2500); // 2.5 seconds debounce

    return () => clearTimeout(timer);
  }, [input]);

  return { analysis, isAnalyzing };
}
