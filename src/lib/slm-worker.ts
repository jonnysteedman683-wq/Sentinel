// src/lib/slm-worker.ts
import { pipeline, env } from '@huggingface/transformers';

// Suppress local file warnings in browser
env.allowLocalModels = false;

// We use a small text generation model for fast "System 1" intrusive thoughts
const MODEL_ID = 'Xenova/Qwen1.5-0.5B-Chat';

class PipelineSingleton {
    static task: any = 'text-generation';
    static model = MODEL_ID;
    static instance: any = null;

    static async getInstance(progress_callback?: any) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { 
                dtype: 'q4',
                device: 'webgpu', // Will fallback to wasm if WebGPU isn't available
                progress_callback 
            });
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {
    const { action, text, context, id } = event.data;

    if (action === 'generate_thought') {
        try {
            const generator = await PipelineSingleton.getInstance((progress: any) => {
                self.postMessage({ type: 'progress', progress });
            });

            const messages = [
                { role: "system", content: "You are System 1, a fast, reactive brain. Generate a micro-insight, auto-tag, or slightly intrusive thought based on the user's input. Reply with a short, punchy sentence." },
                { role: "user", content: context ? `Context: ${context}\nInput: ${text}` : text }
            ];

            const output = await generator(messages, {
                max_new_tokens: 32,
                temperature: 0.9,
                repetition_penalty: 1.2,
                do_sample: true
            });

            let resultText = "";
            if (Array.isArray(output) && output.length > 0 && output[0].generated_text) {
                const generated = output[0].generated_text;
                if (Array.isArray(generated)) {
                   resultText = generated[generated.length - 1].content || "";
                } else {
                   resultText = typeof generated === 'string' ? generated : JSON.stringify(generated);
                }
            }

            self.postMessage({
                type: 'complete',
                id,
                result: resultText
            });
            
        } catch (error: any) {
            self.postMessage({ type: 'error', id, error: error.message });
        }
    } else if (action === 'load') {
        try {
            await PipelineSingleton.getInstance((progress: any) => {
                self.postMessage({ type: 'progress', progress });
            });
            self.postMessage({ type: 'loaded' });
        } catch (error: any) {
            self.postMessage({ type: 'error', error: error.message });
        }
    }
});
