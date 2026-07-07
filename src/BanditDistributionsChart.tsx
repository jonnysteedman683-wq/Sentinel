import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

export interface BanditArm {
  agentId: string;
  alpha: number;
  beta: number;
}

interface Props {
  arms: BanditArm[];
  height?: number;
  resolution?: number; // samples across x ∈ (0,1)
}

// ---------------------------------------------------------------------------
// Math — log-gamma (Lanczos g=7), stable Beta PDF
// ---------------------------------------------------------------------------
const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012,
  9.9843695780195716e-6, 1.5056327351493116e-7,
];

function lgamma(z: number): number {
  if (z < 0.5) {
    // Reflection: Γ(z)Γ(1−z) = π / sin(πz)
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  }
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < LANCZOS.length; i++) x += LANCZOS[i] / (z + i + 1);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** ln B(a,b) = lnΓ(a) + lnΓ(b) − lnΓ(a+b) */
function logBeta(a: number, b: number): number {
  return lgamma(a) + lgamma(b) - lgamma(a + b);
}

/** Beta PDF computed entirely in log space, exp'd at the end. */
function betaPdf(x: number, a: number, b: number): number {
  if (x <= 0 || x >= 1) return 0;
  const logPdf = (a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logBeta(a, b);
  return Math.exp(logPdf);
}

// ---------------------------------------------------------------------------
// Palette — house neon domains, cycled
// ---------------------------------------------------------------------------
const PALETTE = [
  '#22d3ee', // cyan-400
  '#34d399', // emerald-400
  '#fb7185', // rose-400
  '#e879f9', // fuchsia-400
  '#fbbf24', // amber-400
  '#60a5fa', // blue-400
];

interface Curve {
  agentId: string;
  color: string;
  mean: number;
  points: [number, number][]; // [x, density]
}

// ---------------------------------------------------------------------------
export default function BanditDistributionsChart({
  arms,
  height = 320,
  resolution = 256,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);
  const [tooltip, setTooltip] = useState<{
    x: number; px: number; py: number;
    agentId: string; density: number; mean: number; color: string;
  } | null>(null);

  // Responsive width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute curves once per arms change
  const curves: Curve[] = useMemo(() => {
    return arms.map((arm, i) => {
      const points: [number, number][] = [];
      for (let s = 0; s <= resolution; s++) {
        const x = s / resolution;
        points.push([x, betaPdf(x, arm.alpha, arm.beta)]);
      }
      return {
        agentId: arm.agentId,
        color: PALETTE[i % PALETTE.length],
        mean: arm.alpha / (arm.alpha + arm.beta),
        points,
      };
    });
  }, [arms, resolution]);

  const maxDensity = useMemo(
    () => Math.max(1e-9, ...curves.flatMap((c) => c.points.map((p) => p[1]))),
    [curves],
  );

  // D3 render
  useEffect(() => {
    if (!svgRef.current || width === 0 || curves.length === 0) return;

    const margin = { top: 16, right: 16, bottom: 28, left: 40 };
    const iw = width - margin.left - margin.right;
    const ih = height - margin.top - margin.bottom;

    const xScale = d3.scaleLinear().domain([0, 1]).range([0, iw]);
    const yScale = d3.scaleLinear().domain([0, maxDensity * 1.05]).range([ih, 0]);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Axes — slate, mono feel
    const axisColor = '#334155'; // slate-700
    const tickColor = '#64748b'; // slate-500
    const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat(d3.format('.1f'));
    const yAxis = d3.axisLeft(yScale).ticks(4).tickFormat(d3.format('.1f'));

    const styleAxis = (sel: d3.Selection<SVGGElement, unknown, null, undefined>) => {
      sel.selectAll('path, line').attr('stroke', axisColor);
      sel.selectAll('text')
        .attr('fill', tickColor)
        .attr('font-size', '9px')
        .attr('font-family', 'ui-monospace, monospace');
    };

    styleAxis(g.append('g').attr('transform', `translate(0,${ih})`).call(xAxis));
    styleAxis(g.append('g').call(yAxis));

    const area = d3.area<[number, number]>()
      .x((d) => xScale(d[0]))
      .y0(ih)
      .y1((d) => yScale(d[1]))
      .curve(d3.curveBasis);

    const line = d3.line<[number, number]>()
      .x((d) => xScale(d[0]))
      .y((d) => yScale(d[1]))
      .curve(d3.curveBasis);

    for (const c of curves) {
      g.append('path')
        .datum(c.points)
        .attr('d', area)
        .attr('fill', c.color)
        .attr('fill-opacity', 0.12);

      g.append('path')
        .datum(c.points)
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', c.color)
        .attr('stroke-width', 1.5)
        .attr('style', `filter: drop-shadow(0 0 6px ${c.color}66)`);

      // Expected value marker
      g.append('line')
        .attr('x1', xScale(c.mean)).attr('x2', xScale(c.mean))
        .attr('y1', 0).attr('y2', ih)
        .attr('stroke', c.color)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3')
        .attr('stroke-opacity', 0.6);
    }

    // Hover interaction — bisector on x, nearest curve by density at x
    const bisect = d3.bisector<[number, number], number>((d) => d[0]).center;

    const overlay = g.append('rect')
      .attr('width', iw).attr('height', ih)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    const hoverLine = g.append('line')
      .attr('y1', 0).attr('y2', ih)
      .attr('stroke', '#94a3b8').attr('stroke-width', 0.5)
      .attr('stroke-dasharray', '2,2')
      .style('display', 'none');

    overlay
      .on('mousemove', (event) => {
        const [mx, my] = d3.pointer(event);
        const x = xScale.invert(mx);
        const mouseDensity = yScale.invert(my);

        // Nearest curve: minimize |density(x) − cursorDensity|
        let best: Curve | null = null;
        let bestDensity = 0;
        let bestDist = Infinity;
        for (const c of curves) {
          const i = bisect(c.points, x);
          const d = c.points[i]?.[1] ?? 0;
          const dist = Math.abs(d - mouseDensity);
          if (dist < bestDist) {
            bestDist = dist;
            best = c;
            bestDensity = d;
          }
        }
        if (!best) return;

        hoverLine.style('display', null).attr('x1', mx).attr('x2', mx);
        setTooltip({
          x,
          px: mx + margin.left,
          py: my + margin.top,
          agentId: best.agentId,
          density: bestDensity,
          mean: best.mean,
          color: best.color,
        });
      })
      .on('mouseleave', () => {
        hoverLine.style('display', 'none');
        setTooltip(null);
      });
  }, [curves, width, height, maxDensity]);

  return (
    <div ref={containerRef} className="relative w-full">
      <svg ref={svgRef} width="100%" height={height} />

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded border border-slate-700
                     bg-slate-900/90 px-2 py-1.5 font-mono text-[10px] backdrop-blur"
          style={{
            left: Math.min(tooltip.px + 12, width - 150),
            top: tooltip.py - 8,
            boxShadow: `0 0 12px ${tooltip.color}33`,
          }}
        >
          <div className="uppercase tracking-widest" style={{ color: tooltip.color }}>
            {tooltip.agentId}
          </div>
          <div className="mt-0.5 text-slate-400">
            x = {tooltip.x.toFixed(3)}
          </div>
          <div className="text-slate-400">
            E[θ] = {tooltip.mean.toFixed(3)}
          </div>
          <div className="text-slate-500">
            pdf = {tooltip.density.toFixed(2)}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-3">
        {curves.map((c) => (
          <div key={c.agentId} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: c.color, boxShadow: `0 0 6px ${c.color}` }}
            />
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
              {c.agentId} · {c.mean.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
