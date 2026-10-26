import { performance } from 'perf_hooks';

// Original
function processDataOriginal(data: any): any {
  if (data === null || typeof data !== "object") return data;
  const copy = { ...data };
  for (const key of Object.keys(copy)) {
    if (copy[key] && copy[key].__isShim) {
      copy[key] = copy[key].value;
    } else if (Array.isArray(copy[key])) {
      copy[key] = copy[key].map((item: any) => processDataOriginal(item));
    } else if (typeof copy[key] === "object" && copy[key] !== null) {
      copy[key] = processDataOriginal(copy[key]);
    }
  }
  return copy;
}

// Optimized with for...in
function processDataOptimized(data: any): any {
  if (data === null || typeof data !== "object") return data;
  const copy = { ...data };
  for (const key in copy) {
    const val = copy[key];
    if (val && val.__isShim) {
      copy[key] = val.value;
    } else if (Array.isArray(val)) {
      copy[key] = val.map((item: any) => processDataOptimized(item));
    } else if (typeof val === "object" && val !== null) {
      copy[key] = processDataOptimized(val);
    }
  }
  return copy;
}

function generateDeepObject(depth: number, breadth: number): any {
  if (depth === 0) return { a: 1, b: "test", c: true, shim: { __isShim: true, value: 42 } };
  const obj: any = {};
  for (let i = 0; i < breadth; i++) {
    obj[`key_${i}`] = generateDeepObject(depth - 1, breadth);
  }
  obj.arr = Array.from({ length: breadth }).map(() => generateDeepObject(depth - 1, breadth));
  return obj;
}

const testData = generateDeepObject(4, 5); // Some deeply nested data
console.log("Data generated");

const ITERATIONS = 1000;

// Warmup
for(let i=0; i<100; i++) {
  processDataOriginal(testData);
  processDataOptimized(testData);
}

const start1 = performance.now();
for(let i=0; i<ITERATIONS; i++) {
  processDataOriginal(testData);
}
const end1 = performance.now();
const timeOriginal = end1 - start1;

const start2 = performance.now();
for(let i=0; i<ITERATIONS; i++) {
  processDataOptimized(testData);
}
const end2 = performance.now();
const timeOptimized = end2 - start2;

console.log(`Original: ${timeOriginal.toFixed(2)}ms`);
console.log(`Optimized: ${timeOptimized.toFixed(2)}ms`);
console.log(`Improvement: ${((timeOriginal - timeOptimized) / timeOriginal * 100).toFixed(2)}%`);
