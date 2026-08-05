import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import { simd } from 'wasm-feature-detect';

let initialized = false;

export async function initTfjsBackend() {
  if (initialized) return;
  try {
    const isWebGPUSupported = await tf.env().getAsync('WEBGPU_IS_SUPPORTED');
    if (isWebGPUSupported) {
      await tf.setBackend('webgpu');
      await tf.ready();
      console.log(`[TFJS] Backend set to: ${tf.getBackend()}`);
      initialized = true;
      return;
    }
  } catch (e) {
    console.warn('[TFJS] WebGPU initialization failed, falling back to WASM', e);
  }

  try {
    const hasSimd = await simd();
    console.log(`[TFJS] WASM SIMD supported: ${hasSimd}`);
    
    // We can use a CDN for paths if not bundled.
    setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/');
    
    await tf.setBackend('wasm');
    await tf.ready();
    console.log(`[TFJS] Backend set to: ${tf.getBackend()}`);
    initialized = true;
  } catch (err) {
    console.error("[TFJS] Failed to initialize WASM SIMD backend", err);
  }
}
