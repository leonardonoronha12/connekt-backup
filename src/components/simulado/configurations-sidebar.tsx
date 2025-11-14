import React, { useState } from 'react';

export const ConfigurationsSidebarComponent: React.FC = () => {
  const [shuffle, setShuffle] = useState(true);
  const [showAnswers, setShowAnswers] = useState(false);
  const [timeLimit, setTimeLimit] = useState(60);

  return (
    <aside className="w-full lg:w-[300px] bg-white border border-[#E3E4E5] rounded-[10px] p-4 h-fit">
      <h3 className="text-[16px] font-semibold text-[#000000] mb-3">Configurações</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[#3A3D45]">Embaralhar questões</span>
          <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[#3A3D45]">Mostrar respostas ao final</span>
          <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} />
        </div>
        <div className="space-y-2">
          <label className="text-[12px] text-[#3A3D45]">Tempo limite (min)</label>
          <input
            type="number"
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
            className="w-full px-3 py-2 border border-[#E3E4E5] rounded focus:outline-none focus:ring-2 focus:ring-[#0047BB]"
          />
        </div>
      </div>
    </aside>
  );
};