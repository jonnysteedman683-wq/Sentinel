import * as ort from 'onnxruntime-web';

export function preprocess(pixels: Uint8Array, srcW: number, srcH: number): ort.Tensor {
  const targetSize = 640;
  const canvas = new OffscreenCanvas(srcW, srcH);
  const ctx = canvas.getContext('2d')!;
  
  // Convert RGB back to RGBA for canvas rendering if we received RGB
  const rgbaPixels = new Uint8ClampedArray(srcW * srcH * 4);
  for (let i = 0, j = 0; i < pixels.length; i += 3, j += 4) {
    rgbaPixels[j] = pixels[i];
    rgbaPixels[j+1] = pixels[i+1];
    rgbaPixels[j+2] = pixels[i+2];
    rgbaPixels[j+3] = 255;
  }

  const imgData = new ImageData(rgbaPixels, srcW, srcH);
  ctx.putImageData(imgData, 0, 0);

  // Resize
  const resizedCanvas = new OffscreenCanvas(targetSize, targetSize);
  const rctx = resizedCanvas.getContext('2d')!;
  rctx.drawImage(canvas, 0, 0, targetSize, targetSize);
  const resizedData = rctx.getImageData(0, 0, targetSize, targetSize).data; // RGBA

  const floatArr = new Float32Array(3 * targetSize * targetSize);
  const normFactor = 1 / 255.0;
  
  // CHW format expected by YOLOv8 usually, but following the prompt logic:
  // If the model expects NCHW:
  for (let i = 0, j = 0; i < resizedData.length; i += 4, j++) {
    floatArr[j] = resizedData[i] * normFactor;                                         // R
    floatArr[j + targetSize * targetSize] = resizedData[i + 1] * normFactor;           // G
    floatArr[j + 2 * targetSize * targetSize] = resizedData[i + 2] * normFactor;       // B
  }

  return new ort.Tensor('float32', floatArr, [1, 3, targetSize, targetSize]);
}

export function postprocess(outputs: any, origW: number, origH: number) {
  // Standard YOLOv8 ONNX output: name 'output0', shape [1,84,8400]
  const output = outputs.output0;
  if (!output) return [];
  const [batch, dims, numBoxes] = output.dims;
  const raw = output.data as Float32Array;
  const boxes: number[][] = [];

  // If output is [1, 84, 8400], columns are boxes and rows are channels
  // But let's follow the simple parsing if we assume it's flat:
  for (let i = 0; i < numBoxes; i++) {
    // Correct YOLOv8 parsing: index is `c * numBoxes + i` where c is channel (0-83)
    const cx = raw[0 * numBoxes + i];
    const cy = raw[1 * numBoxes + i];
    const w  = raw[2 * numBoxes + i];
    const h  = raw[3 * numBoxes + i];

    // Find max class confidence
    let maxConf = -Infinity;
    let maxClass = -1;
    for (let c = 0; c < 80; c++) {
      const conf = raw[(4 + c) * numBoxes + i];
      if (conf > maxConf) { maxConf = conf; maxClass = c; }
    }
    if (maxConf < 0.5) continue; // threshold

    // Convert to xyxy (pixels in original image coords)
    const x1 = ((cx - w / 2) / 640) * origW;
    const y1 = ((cy - h / 2) / 640) * origH;
    const x2 = ((cx + w / 2) / 640) * origW;
    const y2 = ((cy + h / 2) / 640) * origH;

    boxes.push([x1, y1, x2, y2, maxConf, maxClass]);
  }

  // Non-Maximum Suppression (simple greedy implementation)
  const sorted = boxes.sort((a, b) => b[4] - a[4]);
  const kept: typeof boxes = [];
  while (sorted.length) {
    const current = sorted.shift()!;
    kept.push(current);
    for (let i = sorted.length - 1; i >= 0; i--) {
      const iou = computeIoU(current, sorted[i]);
      if (iou > 0.45) sorted.splice(i, 1);
    }
  }

  return kept.map(b => ({
    bbox: [b[0], b[1], b[2], b[3]], // [x1,y1,x2,y2]
    class: b[5],
    confidence: b[4],
  }));
}

function computeIoU(a: number[], b: number[]) {
  const ax1 = a[0], ay1 = a[1], ax2 = a[2], ay2 = a[3];
  const bx1 = b[0], by1 = b[1], bx2 = b[2], by2 = b[3];
  const xI = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
  const yI = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
  const inter = xI * yI;
  const areaA = (ax2 - ax1) * (ay2 - ay1);
  const areaB = (bx2 - bx1) * (by2 - by1);
  return inter / (areaA + areaB - inter);
}
