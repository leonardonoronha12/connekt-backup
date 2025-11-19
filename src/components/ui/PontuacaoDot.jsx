import React from 'react';
import { Trophy } from 'lucide-react';

const PontuacaoDot = ({ className, alt = 'Pontos', colorClass = 'text-yellow-400' }) => {
  const classes = ['w-3 h-3', colorClass, className].filter(Boolean).join(' ');
  return (
    <Trophy
      className={classes}
      role="img"
      aria-label={alt}
    />
  );
};

export default PontuacaoDot;