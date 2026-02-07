import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const Sidebar = ({
  conversations,
  activeId,
  searchTerm,
  onSearchChange,
  onSelectConversation,
  activeFilters,
  setActiveFilters,
  filterOptions
}) => {
  const [isFilterHovered, setIsFilterHovered] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  const handleFilterChange = filterName => {
    setActiveFilters(prev => {
      const isAlreadyActive = prev.includes(filterName);
      if (isAlreadyActive) {
        return prev.filter(f => f !== filterName);
      } else {
        return [...prev, filterName];
      }
    });
  };

  const handleClearFilters = () => {
    setActiveFilters([]);
    setIsFilterMenuOpen(false);
  };
  
  const hasActiveFilters = activeFilters.length > 0;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) {
      return 'Ontem';
    }
    return date.toLocaleDateString('pt-BR');
  };

  return <aside className="bg-white flex flex-col h-full relative z-10 border-r border-[#ebecef]" aria-label="Lista de conversas">
      <div className="p-4 flex items-center justify-between border-b border-[#E3E4E5] min-h-[82px]">
        <>
          <h2 className="font-bold tracking-wide text-lg">Inbox</h2>
          <div className="flex gap-2 items-center">
            <DropdownMenu open={isFilterMenuOpen} onOpenChange={setIsFilterMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className={`rounded-[10px] border-none bg-white h-9 px-3 font-normal text-base flex items-center gap-[4px] hover:bg-transparent ${hasActiveFilters || isFilterMenuOpen ? 'text-[#0047BB]' : 'text-[#6B7588]'} hover:text-[#0047BB]`} onMouseEnter={() => setIsFilterHovered(true)} onMouseLeave={() => setIsFilterHovered(false)}>
                  Filtrar
                  <img className="w-[18px] h-[18px]" alt="Filter icon" src={isFilterHovered || hasActiveFilters || isFilterMenuOpen ? "https://horizons-cdn.hostinger.com/7dfc6014-acca-4ff2-a777-18605b72844e/d7c55e504315de63ff2a70ae239983e7.png" : "https://horizons-cdn.hostinger.com/7dfc6014-acca-4ff2-a777-18605b72844e/085f291553461aeef8af0092383972e8.png"} />
                  {hasActiveFilters && (
                    <span className="w-5 h-5 bg-[#0047BB] rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {activeFilters.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[188px] h-auto bg-white shadow-lg rounded-[4px] p-0 border border-[#E3E4E5]">
                <div className="flex flex-col pt-[18px] px-[12px] pb-[12px]">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-[#22252B]">Produtos</span>
                    <button onClick={handleClearFilters} className="text-xs text-[#0047BB] hover:underline" aria-label="Limpar filtros">Limpar</button>
                  </div>
                  <div className="border-b border-[#E3E4E5] w-full mt-2 mb-4"></div>
                  <div className="flex flex-col gap-y-2">
                    {filterOptions.map(filter => <DropdownMenuCheckboxItem key={filter.name} checked={activeFilters.includes(filter.name)} onCheckedChange={() => handleFilterChange(filter.name)} onSelect={e => e.preventDefault()} className="group flex items-center justify-between p-2 rounded-[4px] cursor-pointer text-sm gap-2 outline-none focus:bg-transparent data-[state=checked]:bg-[#F6F5FA] hover:bg-[#F6F5FA]">
                        <div className="flex items-center gap-2">
                          <img src={filter.imageUrl} alt={`${filter.name} icon`} className="w-[20px] h-[20px]" />
                          <span className="text-[#22252B] font-medium text-xs font-['Inter']">{filter.name}</span>
                        </div>
                        {activeFilters.includes(filter.name) && <img src={`data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11.6667 3.5L5.25004 9.91667L2.33337 7" stroke="#3BC5BD" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>')}`} alt="Selected" className="w-[14px] h-[14px]" />}
                      </DropdownMenuCheckboxItem>)}
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      </div>
      <div className="p-3 border-b border-[#ebecef]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="search" placeholder="Buscar por nome de aluno" aria-label="Buscar conversa" className="w-full pl-10 pr-4 py-2.5 rounded-[4px] border border-[#ebecef] bg-[#F8FAFC] outline-none focus:outline-none text-sm font-['Inter'] font-normal text-[#ABADB3]" value={searchTerm} onChange={e => onSearchChange(e.target.value)} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? <p className="text-center text-gray-500 py-4 text-sm">Nenhuma conversa encontrada.</p> : conversations.map(conv => <motion.div key={conv.id} initial={{
        opacity: 0,
        x: -10
      }} animate={{
        opacity: 1,
        x: 0
      }} transition={{
        duration: 0.2,
        delay: 0.05
      }} className={`grid grid-cols-[44px_1fr] gap-2 py-3 px-4 cursor-pointer transition-colors border-b-[1px] ${activeId === conv.id ? 'bg-[#F6F5FA] border-r-[6px] border-[#0047BB]' : 'hover:bg-[#f8f9ff]'} border-b-[#F6F5FA]`} onClick={() => onSelectConversation(conv.id)} role="option" aria-selected={activeId === conv.id}>
              <div className="w-[34px] h-[34px] rounded-full overflow-hidden bg-gray-200 grid place-items-center flex-shrink-0">
                {conv.student.avatar_url ? <img className="w-full h-full object-cover" alt={conv.student.name} src={conv.student.avatar_url} /> : <span className="font-bold text-gray-700">{conv.student.initials}</span>}
              </div>
              <div className="flex flex-col overflow-hidden">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 font-semibold text-[#0f172a] truncate">
                    <span>{conv.student.name}</span>
                    {conv.unread > 0 && <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-red-100 bg-red-500 rounded-full">
                        {conv.unread}
                      </span>}
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">{formatDate(conv.date)}</span>
                </div>
                <p className="text-xs text-gray-600 truncate mt-0.5">
                  {conv.lesson_title || conv.subject}
                </p>
                <span className="inline-block mt-1 text-xs px-2 py-1 border border-[#F0F0F0] rounded-full text-gray-700 self-start">
                  {conv.course_title || conv.tag}
                </span>
              </div>
            </motion.div>)}
      </div>
    </aside>;
};
export default Sidebar;
