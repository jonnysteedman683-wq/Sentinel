import React, { useEffect, useRef } from 'react';

interface UnconsciousBackgroundProps {
  theme: 'dark' | 'light';
  cognitiveLoad: number;
  efeScore: number;
}

export function UnconsciousBackground({ theme, cognitiveLoad, efeScore }: UnconsciousBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', handleResize);

    const particles: { x: number, y: number, vx: number, vy: number, life: number, maxLife: number }[] = [];
    const numParticles = 80;

    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        life: Math.random() * 100,
        maxLife: 100 + Math.random() * 100
      });
    }

    let animationId: number;
    let time = 0;

    const render = () => {
      time += 0.01;
      
      // Clear with very faint trail effect based on cognitive load
      ctx.fillStyle = theme === 'dark' ? `rgba(10, 10, 15, ${0.1 + cognitiveLoad * 0.2})` : `rgba(248, 250, 252, ${0.1 + cognitiveLoad * 0.2})`;
      ctx.fillRect(0, 0, width, height);

      const speedMultiplier = 1 + (efeScore * 2) + cognitiveLoad;

      // Update and draw particles
      particles.forEach(p => {
        // Subtle flow field effect using sine waves
        const angle = Math.sin(p.x * 0.005 + time) + Math.cos(p.y * 0.005 + time);
        p.vx += Math.cos(angle) * 0.01 * speedMultiplier;
        p.vy += Math.sin(angle) * 0.01 * speedMultiplier;

        // Friction
        p.vx *= 0.98;
        p.vy *= 0.98;

        p.x += p.vx * speedMultiplier;
        p.y += p.vy * speedMultiplier;

        // Wrap around
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Draw connections
        particles.forEach(p2 => {
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 150) {
            const opacity = (1 - dist / 150) * 0.15; // Very faint
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            if (theme === 'dark') {
              ctx.strokeStyle = `rgba(99, 102, 241, ${opacity})`;
            } else {
              ctx.strokeStyle = `rgba(45, 212, 191, ${opacity})`;
            }
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = theme === 'dark' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(45, 212, 191, 0.3)';
        ctx.fill();
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [theme, cognitiveLoad, efeScore]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 z-0 pointer-events-none opacity-60" 
    />
  );
}
