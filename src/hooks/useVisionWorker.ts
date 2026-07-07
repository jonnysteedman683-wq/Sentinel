import { useEffect, useRef } from 'react';

export function useVisionWorker(videoRef: React.RefObject<HTMLVideoElement | null>, onDetections: (dets: any[]) => void) {
  const workerRef = useRef<Worker | null>(null);
  const canvasRef = useRef(document.createElement('canvas'));

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/vision.worker.ts', import.meta.url), { type: 'module' });
    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    if (!workerRef.current) return;
    workerRef.current.onmessage = (ev) => {
      if (ev.data.type === 'detections') onDetections(ev.data.detections);
    };
  }, [onDetections]);

  useEffect(() => {
    let last = 0;
    const loop = (now: number) => {
      if (now - last > 1000 && videoRef.current && videoRef.current.readyState >= 2) {
        last = now;
        const v = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = v.videoWidth || 640;
        canvas.height = v.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        
        if (ctx && canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height); // RGBA
          const rgba = imgData.data;

          // Convert RGBA -> RGB
          const rgb = new Uint8Array(canvas.width * canvas.height * 3);
          for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
            rgb[j]     = rgba[i];
            rgb[j + 1] = rgba[i + 1];
            rgb[j + 2] = rgba[i + 2];
          }
          // Post transferable
          workerRef.current?.postMessage({
            rgbData: rgb.buffer,
            width: canvas.width,
            height: canvas.height,
          }, [rgb.buffer]);
        }
      }
      requestAnimationFrame(loop);
    };
    const id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [videoRef]);
}
