'use client';

import { Line, LineChart, ResponsiveContainer } from 'recharts';

type SparklineProps = {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
};

export function Sparkline({
  data,
  color = '#ed6e40',
  height = 44,
  className,
}: SparklineProps) {
  const chartData = (data.length > 0 ? data : [0, 0]).map((v, i) => ({
    i,
    v: Number.isFinite(v) ? v : 0,
  }));

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function sparklineTrendPercent(values: number[]): number {
  if (values.length < 2) return 0;
  const mid = Math.floor(values.length / 2);
  const first = values.slice(0, mid).reduce((a, b) => a + b, 0);
  const second = values.slice(mid).reduce((a, b) => a + b, 0);
  if (first === 0) return second > 0 ? 100 : 0;
  return ((second - first) / first) * 100;
}

/** Decorative trend when only a single KPI value is available. */
export function kpiSparklineFromValue(value: number): number[] {
  const base = Math.max(0, value);
  if (base === 0) return [0, 0, 0, 0, 0, 0, 1];
  return [
    base * 0.62,
    base * 0.74,
    base * 0.68,
    base * 0.82,
    base * 0.9,
    base * 0.95,
    base,
  ];
}
