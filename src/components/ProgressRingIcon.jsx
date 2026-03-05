import React from 'react';

export default function ProgressRingIcon({ value, size = 16, strokeWidth = 2, color = '#0047BB', trackOpacity = 0.3 }) {
  const p = Math.max(0, Math.min(100, Number(value || 0)));
  const vbSize = 24;
  const r = 10;
  const c = 2 * Math.PI * r;
  const dash = (p / 100) * c;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={`0 0 ${vbSize} ${vbSize}`}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
    >
      <circle cx="12" cy="12" r={r} opacity={trackOpacity} />
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform="rotate(-90 12 12)"
      />
    </svg>
  );
}

