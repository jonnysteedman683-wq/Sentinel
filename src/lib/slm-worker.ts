// src/lib/slm-worker.ts
import { env, pipeline, type TextGenerationPipeline } from '@huggingface/transformers';

// Suppress local file warnings in browser
env.allowLocalModels = false;

// We use a small text generation model for fast "System 1" intrusive thoughts
const MODEL_ID = 'Xenova/Qwen1.5-0.5B-Chat';

// Lazily created once per worker; later calls reuse the same pipeline promise.
let generatorPromise: Promise<TextGenerationPipeline> | null = null;

function getGenerator(
  progress_callback?: (progress: unknown) => void,
): Promise<TextGenerationPipeline> {
  if (generatorPromise === null) {
    generatorPromise = pipeline('text-generation', MODEL_ID, {
      dtype: 'q4',
      device: 'webgpu', // Will fallback to wasm if WebGPU isn't available
      progress_callback,
    });
  }
  return generatorPromise;
}

self.addEventListener('message', async (event) => {
  const { action, text, context, id } = event.data;

  if (action === 'generate_thought') {
    try {
      const generator = await getGenerator((progress: any) => {
        self.postMessage({ type: 'progress', progress });
      });

      const messages = [
        {
          role: 'system',
          content:
            "You are System 1, a fast, reactive brain. Generate a micro-insight, auto-tag, or slightly intrusive thought based on the user's input. Reply with a short, punchy sentence.",
        },
        { role: 'user', content: context ? `Context: ${context}\nInput: ${text}` : text },
      ];

      const output = await generator(messages, {
        max_new_tokens: 32,
        temperature: 0.9,
        repetition_penalty: 1.2,
        do_sample: true,
      });

      let resultText = '';
      if (Array.isArray(output) && output.length > 0 && output[0].generated_text) {
        const generated = output[0].generated_text;
        if (Array.isArray(generated)) {
          const content = generated[generated.length - 1].content;
          resultText = typeof content === 'string' ? content : JSON.stringify(content ?? '');
        } else {
          resultText = typeof generated === 'string' ? generated : JSON.stringify(generated);
        }
      }

      self.postMessage({
        type: 'complete',
        id,
        result: resultText,
      });
    } catch (error: any) {
      self.postMessage({ type: 'error', id, error: error.message });
    }
  } else if (action === 'load') {
    try {
      await getGenerator((progress: any) => {
        self.postMessage({ type: 'progress', progress });
      });
      self.postMessage({ type: 'loaded' });
    } catch (error: any) {
      self.postMessage({ type: 'error', error: error.message });
    }
  }
});
