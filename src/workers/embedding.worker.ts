import { pipeline } from '@xenova/transformers';

let embedder: any;
self.onmessage = async (e) => {
  if (!embedder) embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  const { id, text } = e.data;
  const out = await embedder(text, { pooling: 'mean', normalize: true });
  // Send as number array
  const arr = Array.from(out.data as Float32Array);
  self.postMessage({ id, embedding: arr });
};
