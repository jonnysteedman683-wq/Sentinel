import * as ort from 'onnxruntime-web';
import { preprocess, postprocess } from './yolo-utils';

ort.env.wasm.wasmPaths = '/wasm/';

let session: ort.InferenceSession;

async function loadModel() {
  try {
    session = await ort.InferenceSession.create('/models/yolov8n.onnx', { executionProviders: ['wasm'] });
  } catch (err) {
    console.error("Failed to load yolov8 model:", err);
  }
}

self.onmessage = async (e: MessageEvent<{ rgbData: ArrayBuffer; width: number; height: number }>) => {
  if (!session) await loadModel();
  if (!session) {
    self.postMessage({ type: 'detections', detections: [] });
    return;
  }
  
  try {
    const { rgbData, width, height } = e.data; 
    const pixels = new Uint8Array(rgbData);

    // 1. Preprocess
    const inputTensor = preprocess(pixels, width, height); // shape [1,3,640,640]
    // 2. Inference
    const outputs = await session.run({ images: inputTensor });
    // 3. Postprocess
    const detections = postprocess(outputs, width, height); // returns { bbox, class, confidence }[]
    
    self.postMessage({ type: 'detections', detections }); 
  } catch (err) {
    console.error("Vision worker error:", err);
    self.postMessage({ type: 'detections', detections: [] });
  }
};

