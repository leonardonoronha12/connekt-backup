import React, { useState } from 'react';

export const SimulationMetadataComponent: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  return (
    <div className="bg-white border border-[#E3E4E5] rounded-[10px] p-4">
      <h2 className="text-[16px] font-semibold text-[#000000] mb-3">Metadados do simulado</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-[12px] text-[#3A3D45]">Título</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-[#E3E4E5] rounded focus:outline-none focus:ring-2 focus:ring-[#0047BB]"
            placeholder="Informe um título"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-[12px] text-[#3A3D45]">Descrição</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-[#E3E4E5] rounded focus:outline-none focus:ring-2 focus:ring-[#0047BB]"
            placeholder="Breve descrição"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          id="isPublic"
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        <label htmlFor="isPublic" className="text-[12px] text-[#3A3D45]">
          Tornar público
        </label>
      </div>
    </div>
  );
};