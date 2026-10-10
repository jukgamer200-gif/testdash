/**
 * RexaCloud Resource Sparkline Chart
 * SVG wave generator matching the glowing purple graphs in the reference image.
 */

import React from 'react';

interface SparklineProps {
  data?: number[];
  color?: string;
  fillColor?: string;
  height?: number;
  width?: number;
  className?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data = [15, 22, 18, 30, 24, 38, 26, 45, 32, 28, 40, 25, 35, 23],
  color = '#A855F7',
  fillColor = 'rgba(168, 85, 247, 0.12)',
  height = 42,
  width = 240,
  className = '',
}) => {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data, min + 1);
  const range = max - min || 1;

  const paddingY = 4;
  const usableHeight = height - paddingY * 2;
  const stepX = width / (data.length - 1);

  const points = data.map((val, idx) => {
    const x = idx * stepX;
    const y = height - paddingY - ((val - min) / range) * usableHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const fillD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return (
    <div className={`overflow-hidden ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={fillD} fill={`url(#grad-${color.replace('#', '')})`} />
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
