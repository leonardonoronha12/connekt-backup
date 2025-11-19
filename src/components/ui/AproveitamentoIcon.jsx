import React from 'react';

const AproveitamentoIcon = ({ className, alt = 'Aproveitamento', strokeWidth = 2, percent = 60, trackColor = '#E3E4E5' }) => {
  const classes = ['w-4 h-4 text-blue-500', className].filter(Boolean).join(' ');
  const r = 7;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const offset = c * (1 - clamped / 100);

  return (
    <svg
      className={classes}
      viewBox="0 0 16 16"
      role="img"
      aria-label={`${alt} ${clamped}%`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="rotate(-90 8 8)">
        <circle cx="8" cy="8" r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </g>
    </svg>
  );
};

export default AproveitamentoIcon;