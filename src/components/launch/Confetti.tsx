'use client';

import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  rotSpeed: number;
  tilt: number;
  tiltSpeed: number;
  shape: 'rect' | 'circle';
  life: number;
  maxLife: number;
};

// Brand blue + festive accents — premium, not garish.
const COLORS = ['#38bdf8', '#0ea5e9', '#ffffff', '#FFD447', '#FF5CA8', '#8B5CF6', '#34D399'];

/**
 * A self-contained celebratory confetti burst on a full-viewport canvas.
 * Fires several staggered cannons for a sustained "party blast", then the
 * pieces fall under gravity and fade. No external dependencies.
 */
export default function Confetti({ durationMs = 6000 }: { durationMs?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];

    // A cannon launches a spray of pieces from (ox, oy) toward `angle` (radians).
    const cannon = (ox: number, oy: number, angle: number, count: number, power: number) => {
      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * 0.7;
        const a = angle + spread;
        const speed = power * (0.55 + Math.random() * 0.75);
        const maxLife = 140 + Math.random() * 90;
        particles.push({
          x: ox,
          y: oy,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          size: 6 + Math.random() * 8,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.3,
          tilt: Math.random() * Math.PI,
          tiltSpeed: 0.1 + Math.random() * 0.15,
          shape: Math.random() > 0.35 ? 'rect' : 'circle',
          life: 0,
          maxLife,
        });
      }
    };

    const fireVolley = () => {
      // Two corner cannons aimed up-inward + a center fountain.
      cannon(W * 0.12, H + 10, -Math.PI / 2 + 0.5, 55, 17);
      cannon(W * 0.88, H + 10, -Math.PI / 2 - 0.5, 55, 17);
      cannon(W * 0.5, H * 0.72, -Math.PI / 2, 40, 15);
    };

    fireVolley();
    const volleys = [500, 1100, 1900, 3000].map((t) =>
      window.setTimeout(fireVolley, t),
    );

    const GRAVITY = 0.22;
    const DRAG = 0.992;
    const start = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      ctx.clearRect(0, 0, W, H);
      const stopping = now - start > durationMs;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += 1;
        p.vy += GRAVITY;
        p.vx *= DRAG;
        p.vy *= DRAG;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotSpeed;
        p.tilt += p.tiltSpeed;

        const fadeStart = p.maxLife * 0.7;
        const alpha = p.life < fadeStart ? 1 : Math.max(0, 1 - (p.life - fadeStart) / (p.maxLife - fadeStart));

        if (p.life >= p.maxLife || p.y > H + 40 || alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        // tilt gives a shimmering 3D-flip feel
        const flip = Math.abs(Math.sin(p.tilt));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, (-p.size / 2) * flip, p.size, p.size * flip);
        } else {
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size / 2, (p.size / 2) * flip, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (stopping && particles.length === 0) {
        return; // done — stop the loop
      }
      raf = window.requestAnimationFrame(frame);
    };
    raf = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(raf);
      volleys.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('resize', resize);
    };
  }, [durationMs]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[80]"
    />
  );
}
