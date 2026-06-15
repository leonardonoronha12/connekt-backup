import React from 'react'

export default function AnimatedLoginBackground({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 500 960"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="connektBlueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#051134" stopOpacity="1" />
          <stop offset="55%" stopColor="#0047BB" stopOpacity="1" />
          <stop offset="100%" stopColor="#051134" stopOpacity="1" />
        </linearGradient>
      </defs>

      <rect width="500" height="960" fill="url(#connektBlueGradient)" />

      <circle className="connekt-login-bg-shape connekt-login-bg-a" cx="130" cy="260" r="220" fill="#1D4ED8" opacity="0.35" />
      <circle className="connekt-login-bg-shape connekt-login-bg-b" cx="360" cy="420" r="280" fill="#0B2A6B" opacity="0.35" />
      <circle className="connekt-login-bg-shape connekt-login-bg-c" cx="420" cy="560" r="120" fill="#1D4ED8" opacity="0.25" />
      <circle className="connekt-login-bg-shape connekt-login-bg-d" cx="320" cy="760" r="50" fill="#0B2A6B" opacity="0.25" />

      <path
        className="connekt-login-bg-shape connekt-login-bg-e"
        d="M310 190C400 150 470 210 470 310C470 420 380 470 300 440C220 410 210 260 310 190Z"
        fill="#0B2A6B"
        opacity="0.30"
      />
      <path
        className="connekt-login-bg-shape connekt-login-bg-f"
        d="M70 510C120 430 220 430 260 520C300 610 240 700 150 710C60 720 20 600 70 510Z"
        fill="#1D4ED8"
        opacity="0.20"
      />
    </svg>
  )
}

