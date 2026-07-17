import React, { useRef, useEffect } from 'react';

type ModelState = 'Idle' | 'Listening' | 'Reasoning' | 'Learning' | 'Nudging' | 'Consolidating' | 'Inspired' | 'Syncing';
type CognitionDepth = 'Fast' | 'Balanced' | 'Deep Reasoning';

export const PresenceOrb: React.FC<{ state: ModelState; depth: CognitionDepth; isSpeaking?: boolean; cognitiveLoad?: number }> = ({ state, depth, isSpeaking = false, cognitiveLoad = 0.5 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const render = () => {
      // Depth affects animation speed
      const speedMultiplier = depth === 'Fast' ? 1.5 : depth === 'Deep Reasoning' ? 0.5 : 1;
      const baseSpeed = state === 'Reasoning' ? 0.05 : state === 'Listening' ? 0.08 : state === 'Syncing' ? 0.06 : 0.02;
      time += baseSpeed * speedMultiplier;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Base layer
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        // Ripple effect when listening, breathing when idle
        const ripple = state === 'Listening' ? Math.sin(time * 3 + i) * 5 : 0;
        const speakRipple = isSpeaking ? Math.sin(time * 15 + i * 2) * Math.random() * 8 : 0; // simulating vocal amplitude
        const breathe = Math.sin(time + i * Math.PI / 1.5) * 15;
        const radius = 80 + breathe + ripple + speakRipple;
        
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        
        // Color shifts based on state and depth
        let hue1 = 200; // Blue (Idle)
        let hue2 = 240; 
        
        if (state === 'Reasoning') {
          hue1 = depth === 'Deep Reasoning' ? 280 : 260; // Deep purple/indigo
          hue2 = 180; // Teal
        } else if (state === 'Listening') {
          hue1 = 320; // Pinkish
          hue2 = 260; // Purple
        } else if (state === 'Learning') {
          hue1 = 150; // Green
          hue2 = 200; // Blue
        } else if (state === 'Nudging') {
          hue1 = 250; // Indigo
          hue2 = 180; // Teal
        } else if (state === 'Consolidating') {
          hue1 = 280; // Purple
          hue2 = 325; // Pink
        } else if (state === 'Syncing') {
          hue1 = 290; // Magenta
          hue2 = 195; // Cyan
        } else if (state === 'Inspired') {
          hue1 = 40; // Gold/Amber
          hue2 = 30; // Orange
        } else if (isSpeaking) {
          hue1 = 320; // Pinkish/Purple for speaking
          hue2 = 280;
        }
        
        const gradient = ctx.createLinearGradient(
          centerX - radius, centerY - radius, 
          centerX + radius, centerY + radius
        );
        gradient.addColorStop(0, `hsla(${hue1}, 80%, 60%, 0.15)`);
        gradient.addColorStop(1, `hsla(${hue2}, 80%, 60%, 0.15)`);
        
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // --- Wave Visualization ---
      ctx.beginPath();
      ctx.strokeStyle = `hsla(200, 100%, 70%, 0.8)`;
      ctx.lineWidth = 2;
      const waveWidth = 60;
      const waveAmplitude = 10 * cognitiveLoad; // Amplitude syncs with cognitive load
      for (let x = -waveWidth; x <= waveWidth; x++) {
        const y = Math.sin(x * 0.1 + time * 5) * waveAmplitude;
        if (x === -waveWidth) ctx.moveTo(centerX + x, centerY + y);
        else ctx.lineTo(centerX + x, centerY + y);
      }
      ctx.stroke();

      // Special Inspired ring
      if (state === 'Inspired') {
        ctx.beginPath();
        ctx.arc(centerX, centerY, 85, 0, 2 * Math.PI);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      // Swirl layer for reasoning/thinking/syncing
      if (state === 'Reasoning' || state === 'Syncing') {
         for (let i = 0; i < 5; i++) {
           ctx.beginPath();
           const r = 90 + Math.sin(time * 2 + i) * 10;
           // The swirl speed depends on depth
           const swirlSpeed = depth === 'Fast' ? 3 : depth === 'Deep Reasoning' ? 1 : 2;
           const startAngle = time * swirlSpeed + (i * Math.PI * 2 / 5);
           const endAngle = startAngle + Math.PI / 4;
           ctx.arc(centerX, centerY, r, startAngle, endAngle);
           const swirlHue = state === 'Syncing' ? 290 : 180;
           ctx.strokeStyle = `hsla(${swirlHue}, 100%, 70%, 0.4)`;
           ctx.lineWidth = 3;
           ctx.stroke();
         }
      }
      
      // Core glowing center
      ctx.beginPath();
      const speakCore = isSpeaking ? Math.random() * 8 : 0;
      const coreRadius = 40 + Math.sin(time * 2) * 5 + speakCore;
      ctx.arc(centerX, centerY, coreRadius, 0, 2 * Math.PI);
      const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius);
      
      const coreHue = state === 'Reasoning' ? 260 : state === 'Listening' ? 320 : state === 'Nudging' ? 250 : state === 'Consolidating' ? 290 : state === 'Syncing' ? 195 : isSpeaking ? 280 : 200;
      coreGradient.addColorStop(0, `hsla(${coreHue}, 90%, 70%, 0.8)`);
      coreGradient.addColorStop(1, `hsla(${coreHue}, 90%, 70%, 0)`);
      
      ctx.fillStyle = coreGradient;
      ctx.fill();
      
      // 3D Hexad layers
      ctx.save();
      ctx.translate(centerX, centerY);
      
      const numHexads = 3;
      const allHexadsPoints = [];
      const numPoints = 6;
      
      // 3D rotation angles based on state and depth
      const rotSpeedMultiplier = depth === 'Fast' ? 2 : depth === 'Deep Reasoning' ? 0.5 : 1;
      
      for (let h = 0; h < numHexads; h++) {
        const hexRadius = 25 + Math.sin(time * 3 + h * Math.PI) * 3 + h * 8; // Different sizes
        const points = [];
        
        // Offset rotations for each hexad
        const rotX = time * 0.8 * rotSpeedMultiplier + h * (Math.PI / 3);
        const rotY = time * 1.2 * rotSpeedMultiplier + h * (Math.PI / 4);
        const rotZ = time * 0.5 * rotSpeedMultiplier + h * (Math.PI / 2);
        
        for(let i=0; i<numPoints; i++) {
          const angle = (i * Math.PI * 2) / numPoints;
          // Original 3D coordinates (flat hexagon)
          let x = Math.cos(angle) * hexRadius;
          let y = Math.sin(angle) * hexRadius;
          let z = 0;
          
          // Rotate around Z axis
          let x1 = x * Math.cos(rotZ) - y * Math.sin(rotZ);
          let y1 = x * Math.sin(rotZ) + y * Math.cos(rotZ);
          let z1 = z;

          // Rotate around X axis
          let y2 = y1 * Math.cos(rotX) - z1 * Math.sin(rotX);
          let z2 = y1 * Math.sin(rotX) + z1 * Math.cos(rotX);
          let x2 = x1;
          
          // Rotate around Y axis
          let x3 = x2 * Math.cos(rotY) + z2 * Math.sin(rotY);
          let z3 = -x2 * Math.sin(rotY) + z2 * Math.cos(rotY);
          let y3 = y2;
          
          // Perspective projection
          const fov = 150;
          const scale = fov / (fov + z3);
          
          points.push({
            x: x3 * scale,
            y: y3 * scale,
            scale: scale
          });
        }
        allHexadsPoints.push(points);
      }
      
      // Draw hexads
      for (let h = 0; h < numHexads; h++) {
        const points = allHexadsPoints[h];
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for(let i=1; i<numPoints; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        
        ctx.strokeStyle = `hsla(${coreHue}, 100%, 85%, ${0.8 - h*0.2})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Draw points
        for(let i=0; i<numPoints; i++) {
          ctx.beginPath();
          ctx.arc(points[i].x, points[i].y, 2 * points[i].scale, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${coreHue}, 100%, 95%, ${0.9 - h*0.2})`;
          ctx.fill();
        }
        
        // Draw inner connections to form a web/hexad
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[3].x, points[3].y);
        ctx.moveTo(points[1].x, points[1].y);
        ctx.lineTo(points[4].x, points[4].y);
        ctx.moveTo(points[2].x, points[2].y);
        ctx.lineTo(points[5].x, points[5].y);
        ctx.strokeStyle = `hsla(${coreHue}, 100%, 85%, ${0.4 - h*0.1})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      
      // Inter-hexad connections
      ctx.beginPath();
      for (let h = 0; h < numHexads - 1; h++) {
        const pointsA = allHexadsPoints[h];
        const pointsB = allHexadsPoints[h+1];
        for (let i = 0; i < numPoints; i++) {
          ctx.moveTo(pointsA[i].x, pointsA[i].y);
          ctx.lineTo(pointsB[i].x, pointsB[i].y);
        }
      }
      ctx.strokeStyle = `hsla(${coreHue}, 100%, 85%, 0.3)`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, depth, cognitiveLoad]);

  return (
    <div className="relative flex items-center justify-center mix-blend-screen opacity-80 pointer-events-none">
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={300} 
        className="w-[300px] h-[300px] blur-[1px]" 
      />
    </div>
  );
};
