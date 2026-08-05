import fs from 'fs';
const wasmBuffer = fs.readFileSync('./build/release.wasm');
WebAssembly.instantiate(wasmBuffer).then(wasmModule => {
  const exports = wasmModule.instance.exports;
  
  // Allocate memory
  // 100 floats = 400 bytes
  const len = 100;
  // We can write to memory
  const memory = new Float32Array(exports.memory.buffer);
  for (let i=0; i<len; i++) {
    memory[i] = 1.0;
    memory[len+i] = 2.0;
  }
  
  const aRaw = 0;
  const bRaw = len * 4;
  
  console.log(exports.simdDot(aRaw, bRaw, len));
});
