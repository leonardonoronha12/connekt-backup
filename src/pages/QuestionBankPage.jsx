import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Plus, Search, ChevronDown, Award, CalendarDays, ListFilter, X, Hash, Tag, Hourglass, Pencil, Trash, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import Skeleton from '@/components/ui/Skeleton.jsx'
import { useTaxonomy } from '@/contexts/TaxonomyContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import questionBankService from '@/services/questionBankService';

const mockQuestionBanks = [
  {
    id: 1,
    name: "Nome do banco de questões",
    description: "Descrição que foi adicionada no ato da criação do banco de questões",
    tags: [
      { id: 1, name: 'Tag', color: '#FFC107' },
      { id: 2, name: 'Tag', color: '#2196F3' }
    ],
    category: 'Neurologia',
    subcategory: 'Subcategoria A',
    questionCount: 50,
    createdAt: "20/08/2025",
    type: "existing",
  },
  {
    id: 2,
    name: "Nome do banco de questões",
    description: "Descrição que foi adicionada no ato da criação do banco de questões",
    tags: [
      { id: 3, name: 'Tag', color: '#F44336' },
      { id: 4, name: 'Tag Adicional', color: '#4CAF50' }
    ],
    category: 'Cardiologia',
    subcategory: 'Subcategoria B',
    questionCount: 50,
    createdAt: "20/08/2025",
    type: "existing",
  },
  { id: 3, type: "create" },
  { id: 4, type: "create" },
  { id: 5, type: "create" },
  { id: 6, type: "create" },
  { id: 7, type: "create" },
  { id: 8, type: "create" },
];

const BankCardIcon = () => (
  <img src="/bank-icon.svg" alt="Ícone do banco" className="w-20 h-20" />
);

const ExistingBankCard = ({ bank, onAction }) => {
  // Formatando a data para o formato brasileiro
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateString;
    }
  };

  // Garantindo que tags seja sempre um array
  const tags = Array.isArray(bank.tags) ? bank.tags : [];
  
  return (
    <div 
      className="bg-white p-3 sm:p-4 lg:p-6 rounded border border-gray-200/80 shadow-sm flex flex-col justify-between min-h-[220px] sm:min-h-[250px] lg:min-h-[295px] w-full overflow-hidden compact-cards ultra-compact-cards cursor-pointer hover:shadow-md transition-shadow relative"
      onClick={() => onAction('edit', bank)}
    >
      {bank?.status === 'draft' && (
        <span className="absolute top-3 right-3 bg-yellow-100 text-yellow-800 text-[10px] font-inter font-medium px-2 py-1 rounded">Rascunho</span>
      )}
      <div className="flex-1">
        <div className="flex justify-start mb-4">
          <BankCardIcon />
        </div>
        <h3 className="text-base font-semibold text-gray-800 mb-1 break-words line-clamp-2 ultra-compact-text">{bank.name}</h3>
        <p className="text-[12px] font-normal font-inter text-gray-500 mb-4 line-clamp-2 ultra-compact-text" style={{color: '#9291A5'}}>{bank.description}</p>
        <div className="flex flex-wrap gap-2 mb-4 min-h-[24px]">
          {/* Mostrar apenas categoria */}
          {bank.category && (
            <span className="px-2 py-1 text-xs font-medium text-blue-700 rounded flex items-center gap-1" style={{backgroundColor: '#2196F320'}}>
              <div className="w-[10px] h-[10px]" style={{backgroundColor: '#2196F3'}}></div>
              {bank.category}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between w-full mt-auto">
        <div className="text-xs text-gray-500">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" className="mr-1"> 
              <rect width="14" height="14" rx="7" fill="#FFCC00"/> 
              <g clipPath="url(#clip0_606_55740)"> 
                <path fillRule="evenodd" clipRule="evenodd" d="M7.00005 4.30078C6.45151 4.30078 5.91324 4.34541 5.3887 4.43129C5.27991 4.4491 5.20005 4.5431 5.20005 4.65334V4.7693C4.95207 4.81635 4.70745 4.87293 4.46659 4.93866C4.37151 4.96461 4.30439 5.04942 4.30097 5.14792C4.30036 5.16547 4.30005 5.1831 4.30005 5.20078C4.30005 5.97924 4.89298 6.61913 5.65196 6.69355C5.88277 6.95423 6.18836 7.14773 6.53552 7.24022C6.50667 7.47612 6.43572 7.69882 6.33044 7.90078H6.25005C6.00152 7.90078 5.80005 8.10225 5.80005 8.35078V9.10078H5.57505C5.36794 9.10078 5.20005 9.26867 5.20005 9.47578C5.20005 9.60004 5.30078 9.70078 5.42505 9.70078H8.57505C8.69931 9.70078 8.80005 9.60004 8.80005 9.47578C8.80005 9.26867 8.63216 9.10078 8.42505 9.10078H8.20005V8.35078C8.20005 8.10225 7.99858 7.90078 7.75005 7.90078H7.66966C7.56437 7.69882 7.49343 7.47612 7.46458 7.24022C7.81173 7.14773 8.11733 6.95423 8.34814 6.69355C9.10711 6.61913 9.70005 5.97924 9.70005 5.20078C9.70005 5.18309 9.69974 5.16547 9.69913 5.14792C9.69571 5.04942 9.62858 4.96461 9.5335 4.93866C9.29265 4.87293 9.04803 4.81635 8.80005 4.7693V4.65334C8.80005 4.5431 8.72019 4.4491 8.6114 4.43129C8.08686 4.34541 7.54858 4.30078 7.00005 4.30078ZM4.75762 5.32751C4.90373 5.29071 5.05123 5.25742 5.20005 5.22773V5.50078C5.20005 5.72263 5.24026 5.93526 5.31377 6.13165C5.01425 5.97484 4.79975 5.67768 4.75762 5.32751ZM9.24248 5.32751C9.20034 5.67768 8.98585 5.97485 8.68633 6.13165C8.75984 5.93526 8.80005 5.72263 8.80005 5.50078V5.22773C8.94886 5.25742 9.09637 5.29071 9.24248 5.32751Z" fill="#0F0627"/> 
              </g> 
              <defs> 
                <clipPath id="clip0_606_55740"> 
                  <rect width="6" height="6" fill="white" transform="translate(4 4)"/> 
                </clipPath> 
              </defs> 
            </svg>
          <span className="font-inter font-semibold text-[12px]" style={{color: '#1E1B39'}}>{(bank.questionCount ?? bank.question_count ?? 0)} questões</span>
          </div>
          <div className="mt-1">
            <span className="block text-[10px] font-inter font-normal truncate" style={{color: '#9291A5'}}>Criado em: {formatDate(bank.createdAt ?? bank.created_at)}</span>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="border-gray-300 text-gray-700 w-[71px] h-[31px] font-inter font-medium text-[10px] rounded-[4px]" 
          style={{color: '#22252B'}} 
          onClick={(e) => {
            e.stopPropagation();
            onAction('view', bank.id);
          }}
        >
          Visualizar
        </Button>
        {/* Botão de "Ativar" removido conforme solicitação */}
      </div>
    </div>
  );
};

const CreateNewBankCard = ({ onAction }) => {
  return (
    <div
      className="p-3 sm:p-4 lg:p-6 rounded border shadow-sm flex flex-col items-center justify-center min-h-[220px] sm:min-h-[250px] lg:min-h-[295px] w-full overflow-hidden compact-cards ultra-compact-cards cursor-pointer hover:bg-gray-50/50 hover:border-blue-500 transition-colors group"
      style={{backgroundColor: '#F9FAFB', borderColor: '#E3E4E5'}}
      onClick={() => onAction('create')}
    >
      <div className="w-16 h-16 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors mb-4">
        <Plus className="w-8 h-8 text-gray-400 group-hover:text-blue-600 transition-colors" />
      </div>
      <p className="text-[14px] font-normal text-gray-500 group-hover:text-blue-600 text-center transition-colors font-inter ultra-compact-text">Criar um novo banco de questões</p>
    </div>
  );
};

const DecorativeIcons = () => (
  <div className="absolute top-0 right-0 p-4 opacity-100 z-50">
    <svg xmlns="http://www.w3.org/2000/svg" width="188" height="150" viewBox="0 0 188 150" fill="none" className="absolute -top-4 right-[42px] w-[188px] h-[150px] transform rotate-0 z-50">
      <path d="M122 77.7098C122 71.2427 127.243 66 133.71 66H175.691C182.158 66 187.4 71.2426 187.4 77.7098V119.691C187.4 126.158 182.158 131.4 175.691 131.4H133.71C127.243 131.4 122 126.158 122 119.691V77.7098Z" fill="#E051B3"/>
      <g clipPath="url(#clip0_93_850)">
      <path d="M168.189 85.2114H141.211C140.561 85.2114 139.937 85.4698 139.477 85.9298C139.017 86.3897 138.759 87.0135 138.759 87.6639V109.737C138.759 110.387 139.017 111.011 139.477 111.471C139.937 111.931 140.561 112.189 141.211 112.189H143.264C143.496 112.189 143.723 112.123 143.919 111.999C144.116 111.875 144.272 111.698 144.372 111.489C144.968 110.23 145.91 109.166 147.087 108.421C148.264 107.676 149.628 107.281 151.021 107.281C152.414 107.281 153.779 107.676 154.956 108.421C156.133 109.166 157.074 110.23 157.671 111.489C157.77 111.698 157.927 111.875 158.123 111.999C158.32 112.123 158.547 112.189 158.779 112.189H168.189C168.839 112.189 169.463 111.931 169.923 111.471C170.383 111.011 170.641 110.387 170.641 109.737V87.6639C170.641 87.0135 170.383 86.3897 169.923 85.9298C169.463 85.4698 168.839 85.2114 168.189 85.2114ZM151.021 104.832C150.051 104.832 149.103 104.544 148.296 104.005C147.49 103.466 146.861 102.7 146.49 101.804C146.118 100.907 146.021 99.9211 146.211 98.9696C146.4 98.0181 146.867 97.1441 147.553 96.4581C148.239 95.7722 149.113 95.305 150.064 95.1157C151.016 94.9265 152.002 95.0236 152.898 95.3949C153.795 95.7661 154.561 96.3948 155.1 97.2014C155.639 98.0081 155.926 98.9564 155.926 99.9265C155.926 101.227 155.41 102.475 154.49 103.395C153.57 104.315 152.322 104.832 151.021 104.832ZM168.189 109.737H159.518C158.983 108.815 158.302 107.986 157.501 107.284H164.51C164.835 107.284 165.147 107.155 165.377 106.925C165.607 106.695 165.736 106.383 165.736 106.058V91.3427C165.736 91.0175 165.607 90.7056 165.377 90.4756C165.147 90.2456 164.835 90.1165 164.51 90.1165H144.89C144.565 90.1165 144.253 90.2456 144.023 90.4756C143.793 90.7056 143.664 91.0175 143.664 91.3427V106.058C143.664 106.33 143.754 106.594 143.92 106.809C144.087 107.024 144.32 107.178 144.584 107.246C143.764 107.956 143.068 108.798 142.525 109.737H141.211V87.6639H168.189V109.737Z" fill="#E3E4E5"/>
      </g>
      <path d="M0 53.882C0 50.6335 2.63346 48 5.88199 48H26.9696C30.2181 48 32.8516 50.6335 32.8516 53.882V74.9696C32.8516 78.2181 30.2181 80.8516 26.9696 80.8516H5.88199C2.63346 80.8516 0 78.2181 0 74.9696V53.882Z" fill="#EF5E2B"/>
      <g clipPath="url(#clip1_93_850)">
      <path d="M24.3102 71.4465C24.379 71.538 24.421 71.6469 24.4314 71.761C24.4418 71.875 24.4202 71.9897 24.369 72.0922C24.3178 72.1946 24.2391 72.2808 24.1416 72.341C24.0442 72.4011 23.9319 72.433 23.8174 72.4328H9.03418C8.91979 72.4328 8.80766 72.401 8.71035 72.3409C8.61304 72.2807 8.5344 72.1947 8.48324 72.0923C8.43208 71.99 8.41043 71.8755 8.4207 71.7616C8.43098 71.6476 8.47277 71.5388 8.54141 71.4473C9.08683 70.716 9.81417 70.1403 10.6511 69.7773C10.1923 69.3586 9.87089 68.8109 9.72895 68.2063C9.58701 67.6016 9.63121 66.9681 9.85575 66.389C10.0803 65.8099 10.4747 65.3123 10.9871 64.9613C11.4996 64.6104 12.1062 64.4226 12.7273 64.4226C13.3484 64.4226 13.955 64.6104 14.4674 64.9613C14.9799 65.3123 15.3743 65.8099 15.5988 66.389C15.8234 66.9681 15.8676 67.6016 15.7256 68.2063C15.5837 68.8109 15.2622 69.3586 14.8035 69.7773C15.4073 70.0383 15.956 70.4116 16.4204 70.8775C16.8848 70.4116 17.4335 70.0383 18.0373 69.7773C17.5785 69.3586 17.2571 68.8109 17.1152 68.2063C16.9732 67.6016 17.0174 66.9681 17.242 66.389C17.4665 65.8099 17.8609 65.3123 18.3733 64.9613C18.8858 64.6104 19.4924 64.4226 20.1135 64.4226C20.7346 64.4226 21.3412 64.6104 21.8537 64.9613C22.3661 65.3123 22.7605 65.8099 22.985 66.389C23.2096 66.9681 23.2538 67.6016 23.1118 68.2063C22.9699 68.8109 22.6484 69.3586 22.1897 69.7773C23.0305 70.1384 23.7617 70.714 24.3102 71.4465ZM8.6646 64.3021C8.72931 64.3506 8.80295 64.3859 8.88131 64.406C8.95967 64.4261 9.04121 64.4305 9.12129 64.4191C9.20137 64.4076 9.27841 64.3805 9.34801 64.3393C9.41761 64.2981 9.47842 64.2436 9.52695 64.1789C9.89989 63.6816 10.3835 63.278 10.9394 63.0001C11.4954 62.7221 12.1084 62.5774 12.73 62.5774C13.3515 62.5774 13.9646 62.7221 14.5205 63.0001C15.0765 63.278 15.5601 63.6816 15.933 64.1789C15.9904 64.2554 16.0648 64.3175 16.1503 64.3602C16.2358 64.403 16.3302 64.4253 16.4258 64.4253C16.5214 64.4253 16.6157 64.403 16.7013 64.3602C16.7868 64.3175 16.8612 64.2554 16.9186 64.1789C17.2915 63.6816 17.7751 63.278 18.331 63.0001C18.887 62.7221 19.5 62.5774 20.1216 62.5774C20.7431 62.5774 21.3562 62.7221 21.9121 63.0001C22.4681 63.278 22.9517 63.6816 23.3246 64.1789C23.3732 64.2436 23.434 64.2981 23.5037 64.3393C23.5733 64.3805 23.6504 64.4076 23.7305 64.419C23.8107 64.4304 23.8922 64.4259 23.9706 64.4058C24.049 64.3856 24.1226 64.3503 24.1873 64.3017C24.2521 64.2531 24.3066 64.1923 24.3478 64.1226C24.389 64.053 24.416 63.9759 24.4274 63.8958C24.4388 63.8157 24.4343 63.7341 24.4142 63.6557C24.3941 63.5773 24.3587 63.5037 24.3102 63.439C23.7647 62.7079 23.0374 62.1324 22.2005 61.7697C22.6592 61.351 22.9807 60.8034 23.1226 60.1987C23.2646 59.594 23.2203 58.9606 22.9958 58.3815C22.7713 57.8024 22.3769 57.3047 21.8644 56.9538C21.352 56.6028 20.7454 56.415 20.1243 56.415C19.5032 56.415 18.8966 56.6028 18.3841 56.9538C17.8717 57.3047 17.4773 57.8024 17.2527 58.3815C17.0282 58.9606 16.984 59.594 17.1259 60.1987C17.2679 60.8034 17.5893 61.351 18.0481 61.7697C17.4443 62.0307 16.8956 62.4041 16.4312 62.87C15.9668 62.4041 15.4181 62.0307 14.8143 61.7697C15.273 61.351 15.5945 60.8034 15.7364 60.1987C15.8783 59.594 15.8341 58.9606 15.6096 58.3815C15.3851 57.8024 14.9907 57.3047 14.4782 56.9538C13.9658 56.6028 13.3592 56.415 12.7381 56.415C12.117 56.415 11.5104 56.6028 10.9979 56.9538C10.4854 57.3047 10.0911 57.8024 9.86653 58.3815C9.64199 58.9606 9.59779 59.594 9.73973 60.1987C9.88167 60.8034 10.2031 61.351 10.6619 61.7697C9.82102 62.1311 9.08981 62.707 8.54141 63.4397C8.49287 63.5044 8.45756 63.5781 8.43748 63.6564C8.41741 63.7348 8.41296 63.8163 8.4244 63.8964C8.43584 63.9765 8.46294 64.0535 8.50416 64.1231C8.54537 64.1927 8.59989 64.2536 8.6646 64.3021Z" fill="#F9FAFB"/>
      </g>
      <path d="M38 108.063C38 103.058 42.0576 99 47.0629 99H79.5544C84.5597 99 88.6173 103.058 88.6173 108.063V140.554C88.6173 145.56 84.5597 149.617 79.5544 149.617H47.0629C42.0576 149.617 38 145.56 38 140.554V108.063Z" fill="#3BC5BD"/>
      <g clipPath="url(#clip2_93_850)">
      <path d="M75.6466 114.818H68.054C67.0472 114.818 66.0816 115.218 65.3696 115.93C64.6577 116.642 64.2577 117.607 64.2577 118.614V129.022C64.261 129.267 64.1715 129.504 64.007 129.686C63.8426 129.867 63.6156 129.98 63.3715 130.001C63.2417 130.009 63.1115 129.991 62.989 129.947C62.8665 129.903 62.7543 129.835 62.6594 129.746C62.5645 129.657 62.4889 129.549 62.4373 129.43C62.3858 129.31 62.3593 129.182 62.3596 129.052V118.614C62.3596 117.607 61.9596 116.642 61.2477 115.93C60.5357 115.218 59.5701 114.818 58.5633 114.818H50.9707C50.719 114.818 50.4776 114.918 50.2996 115.096C50.1216 115.274 50.0216 115.515 50.0216 115.767V132.85C50.0216 133.102 50.1216 133.343 50.2996 133.521C50.4776 133.699 50.719 133.799 50.9707 133.799H59.5123C60.2662 133.799 60.9894 134.098 61.5231 134.631C62.0569 135.163 62.3577 135.886 62.3596 136.639C62.3558 136.833 62.4121 137.023 62.5209 137.184C62.6297 137.344 62.7855 137.467 62.967 137.535C63.111 137.591 63.2664 137.61 63.4197 137.592C63.5731 137.574 63.7197 137.519 63.8468 137.431C63.974 137.344 64.0779 137.227 64.1495 137.09C64.2211 136.953 64.2582 136.801 64.2577 136.647C64.2577 135.891 64.5577 135.167 65.0916 134.633C65.6256 134.099 66.3498 133.799 67.1049 133.799H75.6466C75.8983 133.799 76.1397 133.699 76.3177 133.521C76.4957 133.343 76.5957 133.102 76.5957 132.85V115.767C76.5957 115.515 76.4957 115.274 76.3177 115.096C76.1397 114.918 75.8983 114.818 75.6466 114.818ZM72.7994 129.054H68.086C67.8411 129.057 67.604 128.968 67.4224 128.803C67.2409 128.639 67.1283 128.412 67.1073 128.168C67.0987 128.038 67.1169 127.908 67.1607 127.785C67.2045 127.663 67.273 127.551 67.362 127.456C67.451 127.361 67.5586 127.285 67.6781 127.234C67.7975 127.182 67.9263 127.156 68.0564 127.156H72.7697C73.0147 127.153 73.2517 127.242 73.4333 127.407C73.6149 127.571 73.7275 127.798 73.7485 128.042C73.7571 128.172 73.7389 128.302 73.6951 128.425C73.6513 128.547 73.5827 128.659 73.4937 128.754C73.4047 128.849 73.2972 128.925 73.1777 128.976C73.0583 129.028 72.9295 129.054 72.7994 129.054ZM72.7994 125.258H68.086C67.8411 125.261 67.604 125.171 67.4224 125.007C67.2409 124.843 67.1283 124.616 67.1073 124.371C67.0987 124.242 67.1169 124.111 67.1607 123.989C67.2045 123.866 67.273 123.754 67.362 123.659C67.451 123.564 67.5586 123.489 67.6781 123.437C67.7975 123.386 67.9263 123.359 68.0564 123.36H72.7697C73.0147 123.356 73.2517 123.446 73.4333 123.61C73.6149 123.775 73.7275 124.002 73.7485 124.246C73.7571 124.376 73.7389 124.506 73.6951 124.628C73.6513 124.751 73.5827 124.863 73.4937 124.958C73.4047 125.053 73.2972 125.128 73.1777 125.180C73.0583 125.232 72.9295 125.258 72.7994 125.258ZM72.7994 121.461H68.086C67.8407 121.465 67.603 121.376 67.4209 121.212C67.2389 121.047 67.1259 120.82 67.1049 120.575C67.0963 120.445 67.1145 120.315 67.1583 120.193C67.2021 120.07 67.2707 119.958 67.3597 119.863C67.4487 119.768 67.5562 119.693 67.6757 119.641C67.7951 119.589 67.9239 119.563 68.054 119.563H72.7674C73.0127 119.559 73.2504 119.649 73.4325 119.813C73.6145 119.978 73.7275 120.205 73.7485 120.449C73.7571 120.579 73.7389 120.709 73.6951 120.832C73.6513 120.954 73.5827 121.067 73.4937 121.162C73.4047 121.256 73.2972 121.332 73.1777 121.384C73.0583 121.435 72.9295 121.462 72.7994 121.461Z" fill="#F9FAFB"/>
      </g>
      <path d="M58 10.0267C58 4.48909 62.4891 0 68.0267 0H103.973C109.511 0 114 4.48909 114 10.0267V45.9733C114 51.5109 109.511 56 103.973 56H68.0267C62.4891 56 58 51.5109 58 45.9733V10.0267Z" fill="#E5B800"/>
      <g clipPath="url(#clip3_93_850)">
      <path d="M99.65 38.5C99.65 38.7784 99.5394 39.0455 99.3424 39.2424C99.1455 39.4393 98.8785 39.55 98.6 39.55H73.4C73.1215 39.55 72.8544 39.4393 72.6575 39.2424C72.4606 39.0455 72.35 38.7784 72.35 38.5C72.35 38.2215 72.4606 37.9544 72.6575 37.7575C72.8544 37.5606 73.1215 37.45 73.4 37.45H98.6C98.8785 37.45 99.1455 37.5606 99.3424 37.7575C99.5394 37.9544 99.65 38.2215 99.65 38.5ZM99.65 18.55V33.25C99.65 33.8069 99.4287 34.341 99.0349 34.7349C98.6411 35.1287 98.1069 35.35 97.55 35.35H74.45C73.893 35.35 73.3589 35.1287 72.9651 34.7349C72.5712 34.341 72.35 33.8069 72.35 33.25V18.55C72.35 17.993 72.5712 17.4589 72.9651 17.065C73.3589 16.6712 73.893 16.45 74.45 16.45H97.55C98.1069 16.45 98.6411 16.6712 99.0349 17.065C99.4287 17.4589 99.65 17.993 99.65 18.55ZM90.725 25.9C90.7249 25.7312 90.6842 25.565 90.6063 25.4154C90.5284 25.2657 90.4156 25.1371 90.2774 25.0403L85.0274 21.3653C84.8701 21.2551 84.6856 21.1901 84.4939 21.1775C84.3022 21.1649 84.1108 21.2051 83.9404 21.2938C83.77 21.3824 83.6272 21.5161 83.5275 21.6803C83.4278 21.8445 83.375 22.0329 83.375 22.225V29.575C83.375 29.767 83.4278 29.9554 83.5275 30.1196C83.6272 30.2838 83.77 30.4175 83.9404 30.5061C84.1108 30.5948 84.3022 30.635 84.4939 30.6224C84.6856 30.6098 84.8701 30.5448 85.0274 30.4346L90.2774 26.7596C90.4156 26.6628 90.5284 26.5342 90.6063 26.3845C90.6842 26.2349 90.7249 26.0687 90.725 25.9Z" fill="#F9FAFB"/>
      </g>
      <defs>
      <clipPath id="clip0_93_850">
      <rect width="39.2402" height="39.2402" fill="white" transform="translate(135.08 79.0801)"/>
      </clipPath>
      <clipPath id="clip1_93_850">
      <rect width="19.7109" height="19.7109" fill="white" transform="translate(6.57031 54.5703)"/>
      </clipPath>
      <clipPath id="clip2_93_850">
      <rect width="30.3704" height="30.3704" fill="white" transform="translate(48.1234 109.124)"/>
      </clipPath>
      <clipPath id="clip3_93_850">
      <rect width="33.6" height="33.6" fill="white" transform="translate(69.2 11.2)"/>
      </clipPath>
      </defs>
    </svg>
  </div>
);

const QuestionBankPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [questionBanks, setQuestionBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    status: 'Todos'
  });
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tags: [],
    category: '',
    subcategory: ''
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [isFormModified, setIsFormModified] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null);

  const parseMulti = (value) => {
    return String(value || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const serializeMulti = (items) => {
    const uniq = [];
    const seen = new Set();
    for (const it of Array.isArray(items) ? items : []) {
      const v = String(it || '').trim();
      if (!v) continue;
      const k = v.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(v);
    }
    return uniq.join(', ');
  };

  const addToMulti = (value, item) => {
    return serializeMulti([...parseMulti(value), item]);
  };

  const removeFromMulti = (value, item) => {
    const target = String(item || '').trim().toLowerCase();
    return serializeMulti(parseMulti(value).filter((v) => v.toLowerCase() !== target));
  };

  const replaceInMulti = (value, oldItem, newItem) => {
    const oldKey = String(oldItem || '').trim().toLowerCase();
    const nextKey = String(newItem || '').trim();
    return serializeMulti(parseMulti(value).map((v) => (v.toLowerCase() === oldKey ? nextKey : v)));
  };

  useEffect(() => {
    if (!isPopupOpen) return;
    const prevOverflow = document?.body?.style?.overflow;
    if (document?.body?.style) document.body.style.overflow = 'hidden';
    return () => {
      if (document?.body?.style) document.body.style.overflow = prevOverflow || '';
    };
  }, [isPopupOpen]);

  // Estados para controlar dropdowns
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);
  const [showTagsDropdown, setShowTagsDropdown] = useState(false);
  
  // Ref para o dropdown de categorias
  const categoryDropdownRef = useRef(null);
  // Ref para o dropdown de subcategorias
  const subcategoryDropdownRef = useRef(null);
  // Ref para o dropdown de tags
  const tagsDropdownRef = useRef(null);
  
  // Estados para pesquisa e criação de categoria
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#8B5CF6');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');

  // Estados para edição de categoria
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryColor, setEditCategoryColor] = useState('#8B5CF6');
  const [editCategoryDescription, setEditCategoryDescription] = useState('');
  // Estado para confirmação de remoção inline
  const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState(null);

  // Estados para subcategoria (busca, criação, edição e remoção)
  const [subcategorySearchTerm, setSubcategorySearchTerm] = useState('');
  const [isCreatingNewSubcategory, setIsCreatingNewSubcategory] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [newSubcategoryColor, setNewSubcategoryColor] = useState('#22C55E');
  const [newSubcategoryDescription, setNewSubcategoryDescription] = useState('');
  const [editingSubcategoryId, setEditingSubcategoryId] = useState(null);
  const [editSubcategoryName, setEditSubcategoryName] = useState('');
  const [editSubcategoryColor, setEditSubcategoryColor] = useState('#22C55E');
  const [editSubcategoryDescription, setEditSubcategoryDescription] = useState('');
  const [pendingDeleteSubcategoryId, setPendingDeleteSubcategoryId] = useState(null);

  // Estados para tags (busca, criação, edição e remoção)
  const [tagsSearchTerm, setTagsSearchTerm] = useState('');
  const [isCreatingNewTag, setIsCreatingNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#0EA5E9');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [editingTagId, setEditingTagId] = useState(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('#0EA5E9');
  const [editTagDescription, setEditTagDescription] = useState('');
  const [pendingDeleteTagId, setPendingDeleteTagId] = useState(null);

  const {
    categories,
    subcategories,
    tags: availableTags,
    createCategory,
    updateCategory,
    deleteCategory,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
    createTag,
    updateTag,
    deleteTag,
  } = useTaxonomy();

  useEffect(() => {
    loadQuestionBanks();
  }, []);

  // Detectar mudanças no formulário
  useEffect(() => {
    if (originalFormData) {
      const hasChanges = 
        formData.name !== originalFormData.name ||
        formData.description !== originalFormData.description ||
        formData.category !== originalFormData.category ||
        formData.subcategory !== originalFormData.subcategory ||
        JSON.stringify(formData.tags) !== JSON.stringify(originalFormData.tags);
      
      setIsFormModified(hasChanges);
    }
  }, [formData, originalFormData]);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setShowCategoryDropdown(false);
        setShowSubcategoryDropdown(false);
        setShowTagsDropdown(false);
        // Limpar estados de categoria
        setCategorySearchTerm('');
        setIsCreatingNewCategory(false);
        setNewCategoryName('');
        setNewCategoryColor('#8B5CF6');
        setNewCategoryDescription('');
        setPendingDeleteCategoryId(null);
        // Limpar estados de subcategoria
        setSubcategorySearchTerm('');
        setIsCreatingNewSubcategory(false);
        setNewSubcategoryName('');
        setNewSubcategoryColor('#22C55E');
        setNewSubcategoryDescription('');
        setEditingSubcategoryId(null);
        setPendingDeleteSubcategoryId(null);
        // Limpar estados de tags
        setTagsSearchTerm('');
        setIsCreatingNewTag(false);
        setNewTagName('');
        setNewTagColor('#0EA5E9');
        setNewTagDescription('');
        setEditingTagId(null);
        setPendingDeleteTagId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Funções auxiliares para categorias
  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(categorySearchTerm.toLowerCase())
  );
  const filteredSubcategories = subcategories.filter(subcategory =>
    subcategory.name.toLowerCase().includes(subcategorySearchTerm.toLowerCase())
  );
  const filteredTags = (availableTags || [])
    .filter(tag => !!tag && typeof tag.name === 'string')
    .filter(tag => tag.name.toLowerCase().includes(tagsSearchTerm.toLowerCase()));

  const selectedCategoryNames = parseMulti(formData.category);
  const selectedSubcategoryNames = parseMulti(formData.subcategory);
  const selectableCategories = filteredCategories.filter(
    (c) => !selectedCategoryNames.some((n) => n.toLowerCase() === String(c?.name || '').toLowerCase())
  );
  const selectableSubcategories = filteredSubcategories.filter(
    (s) => !selectedSubcategoryNames.some((n) => n.toLowerCase() === String(s?.name || '').toLowerCase())
  );

  const handleCreateNewCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    const exists = categories.some(cat => (cat.name || '').toLowerCase() === name.toLowerCase());
    if (exists) {
      toast({ description: 'Já existe uma categoria com este nome.', variant: 'destructive' });
      return;
    }

    createCategory({
      name,
      color: newCategoryColor,
      description: newCategoryDescription.trim(),
      tagIds: [],
    });
    setFormData(prev => ({ ...prev, category: addToMulti(prev.category, name) }));
    setNewCategoryName('');
    setNewCategoryColor('#8B5CF6');
    setNewCategoryDescription('');
    setIsCreatingNewCategory(false);
    setShowCategoryDropdown(false);
    setCategorySearchTerm('');
    toast({ description: 'Categoria criada com sucesso!' });
  };

  const handleCancelNewCategory = () => {
    setNewCategoryName('');
    setNewCategoryColor('#8B5CF6');
    setNewCategoryDescription('');
    setIsCreatingNewCategory(false);
    setCategorySearchTerm('');
  };

  const handleStartEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name);
    setEditCategoryColor(category.color);
    setEditCategoryDescription(category.description || '');
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditCategoryName('');
    setEditCategoryColor('#8B5CF6');
    setEditCategoryDescription('');
  };

  const handleSaveEditCategory = () => {
    if (!editCategoryName.trim() || !editCategoryDescription.trim() || !editingCategoryId) return;
    const id = String(editingCategoryId);
    const oldName = categories.find(c => String(c.id) === id)?.name;
    updateCategory(id, {
      name: editCategoryName.trim(),
      color: editCategoryColor,
      description: editCategoryDescription.trim(),
    });
    // Atualiza seleção se necessário
    setFormData(prev => ({ ...prev, category: replaceInMulti(prev.category, oldName, editCategoryName.trim()) }));
    setEditingCategoryId(null);
    setEditCategoryName('');
    setEditCategoryColor('#8B5CF6');
    setEditCategoryDescription('');
    toast({ description: 'Categoria atualizada com sucesso!' });
  };

  const handleDeleteCategory = (id) => {
    const cat = categories.find(c => String(c.id) === String(id));
    if (!cat) return;
    deleteCategory(String(id));
    setFormData(prev => ({ ...prev, category: removeFromMulti(prev.category, cat.name) }));
    setPendingDeleteCategoryId(null);
    toast({ description: 'Categoria removida com sucesso!' });
  };

  // Funções auxiliares para subcategorias
  const handleCreateNewSubcategory = () => {
    if (newSubcategoryName.trim() && newSubcategoryDescription.trim() &&
        !subcategories.some(sub => sub.name === newSubcategoryName.trim())) {
      createSubcategory({
        name: newSubcategoryName.trim(),
        color: newSubcategoryColor,
        description: newSubcategoryDescription.trim(),
        categoryIds: [],
        tagIds: [],
        productsCount: 0,
      });
      setFormData(prev => ({ ...prev, subcategory: addToMulti(prev.subcategory, newSubcategoryName.trim()) }));
      setNewSubcategoryName('');
      setNewSubcategoryColor('#22C55E');
      setNewSubcategoryDescription('');
      setIsCreatingNewSubcategory(false);
      setShowSubcategoryDropdown(false);
      setSubcategorySearchTerm('');
    }
  };

  const handleCancelNewSubcategory = () => {
    setNewSubcategoryName('');
    setNewSubcategoryColor('#22C55E');
    setNewSubcategoryDescription('');
    setIsCreatingNewSubcategory(false);
    setSubcategorySearchTerm('');
  };

  const handleStartEditSubcategory = (subcategory) => {
    setEditingSubcategoryId(subcategory.id);
    setEditSubcategoryName(subcategory.name);
    setEditSubcategoryColor(subcategory.color);
    setEditSubcategoryDescription(subcategory.description || '');
  };

  const handleCancelEditSubcategory = () => {
    setEditingSubcategoryId(null);
    setEditSubcategoryName('');
    setEditSubcategoryColor('#22C55E');
    setEditSubcategoryDescription('');
  };

  const handleSaveEditSubcategory = () => {
    if (!editSubcategoryName.trim() || !editSubcategoryDescription.trim() || !editingSubcategoryId) return;
    const id = String(editingSubcategoryId);
    const oldName = subcategories.find(s => String(s.id) === id)?.name;
    updateSubcategory(id, {
      name: editSubcategoryName.trim(),
      color: editSubcategoryColor,
      description: editSubcategoryDescription.trim(),
    });
    // Atualiza seleção se necessário
    setFormData(prev => ({ ...prev, subcategory: replaceInMulti(prev.subcategory, oldName, editSubcategoryName.trim()) }));
    setEditingSubcategoryId(null);
    setEditSubcategoryName('');
    setEditSubcategoryColor('#22C55E');
    setEditSubcategoryDescription('');
    toast({ description: 'Subcategoria atualizada com sucesso!' });
  };

  const handleDeleteSubcategory = (id) => {
    const sub = subcategories.find(s => String(s.id) === String(id));
    if (!sub) return;
    deleteSubcategory(String(id));
    setFormData(prev => ({ ...prev, subcategory: removeFromMulti(prev.subcategory, sub.name) }));
    setPendingDeleteSubcategoryId(null);
    toast({ description: 'Subcategoria removida com sucesso!' });
  };

  // Funções auxiliares para tags
  const handleCreateNewTag = () => {
    if (newTagName.trim() && newTagDescription.trim() &&
        !availableTags.some(t => t.name === newTagName.trim())) {
      const created = createTag({
        name: newTagName.trim(),
        color: newTagColor,
        description: newTagDescription.trim(),
      });
      setFormData(prev => ({ ...prev, tags: [...prev.tags, created] }));
      setNewTagName('');
      setNewTagColor('#0EA5E9');
      setNewTagDescription('');
      setIsCreatingNewTag(false);
      setShowTagsDropdown(false);
      setTagsSearchTerm('');
    }
  };

  const handleCancelNewTag = () => {
    setNewTagName('');
    setNewTagColor('#0EA5E9');
    setNewTagDescription('');
    setIsCreatingNewTag(false);
    setTagsSearchTerm('');
  };

  const handleStartEditTag = (tag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
    setEditTagDescription(tag.description || '');
  };

  const handleCancelEditTag = () => {
    setEditingTagId(null);
    setEditTagName('');
    setEditTagColor('#0EA5E9');
    setEditTagDescription('');
  };

  const handleSaveEditTag = () => {
    if (!editTagName.trim() || !editTagDescription.trim() || !editingTagId) return;
    const id = String(editingTagId);
    const updatedTag = { id, name: editTagName.trim(), color: editTagColor, description: editTagDescription.trim() };
    updateTag(id, updatedTag);
    // Atualiza seleção se necessário
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.map(t => (String(t.id) === id ? updatedTag : t))
    }));
    setEditingTagId(null);
    setEditTagName('');
    setEditTagColor('#0EA5E9');
    setEditTagDescription('');
    toast({ description: 'Tag atualizada com sucesso!' });
  };

  const handleDeleteTag = (id) => {
    const tag = availableTags.find(t => String(t.id) === String(id));
    if (!tag) return;
    deleteTag(String(id));
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => String(t.id) !== String(id)) }));
    setPendingDeleteTagId(null);
    toast({ description: 'Tag removida com sucesso!' });
  };

  // Função para scroll automático quando criar nova categoria
  const handleStartCreatingCategory = () => {
    // Pré-preenche com o termo buscado, se houver
    setNewCategoryName((categorySearchTerm || '').trim());
    setIsCreatingNewCategory(true);
    // Aguarda um pouco para o DOM atualizar e depois faz o scroll
    setTimeout(() => {
      if (categoryDropdownRef.current) {
        categoryDropdownRef.current.scrollTop = categoryDropdownRef.current.scrollHeight;
      }
    }, 100);
  };

  const isTransientNetworkError = (err) => {
    const msg = String(err?.message || err || '').toLowerCase();
    return msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed') || msg.includes('err_network') || msg.includes('network');
  };

  const loadQuestionBanks = async () => {
    setLoading(true);
    try {
      const { data, error } = await questionBankService.getQuestionBanks();
      if (error) {
        toast({
          description: "Erro ao carregar bancos de questões: " + error,
          variant: "destructive"
        });
      } else {
        setQuestionBanks(data || []);
      }
    } catch (err) {
      if (!isTransientNetworkError(err)) {
        console.error('Error loading question banks:', err);
      }
      toast({
        description: isTransientNetworkError(err) ? "Sem conexão. Tente novamente em instantes." : "Erro ao conectar com o servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action, data = null) => {
    if (action === 'create') {
      setIsEditMode(false);
      setEditingBank(null);
      const initialData = {
        name: '',
        description: '',
        tags: [],
        category: '',
        subcategory: ''
      };
      setFormData(initialData);
      setOriginalFormData(initialData);
      setIsFormModified(false);
      // Abrir diretamente o formulário de criação
      setIsPopupOpen(true);
      // Comunicar com a página pai (Bubble) para aplicar blur
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'MODAL_OPENED' }, '*');
      }
    } else if (action === 'edit') {
      setIsEditMode(true);
      setEditingBank(data);
      
      // Preencher o formulário com os dados do banco
      const editData = {
        name: data.name || '',
        description: data.description || '',
        tags: data.tags || [],
        category: data.category || '',
        subcategory: data.subcategory || ''
      };
      setFormData(editData);
      setOriginalFormData(JSON.parse(JSON.stringify(editData))); // Deep copy
      setIsFormModified(false);
      
      setIsPopupOpen(true);
      // Comunicar com a página pai (Bubble) para aplicar blur
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'MODAL_OPENED' }, '*');
      }
    } else if (action === 'activate') {
      const bank = typeof data === 'object' ? data : (questionBanks || []).find(b => b && b.id === data);
      if (!bank) {
        toast({ description: 'Banco não encontrado.', variant: 'destructive' });
        return;
      }
      if (bank.status !== 'draft') {
        toast({ description: 'Este banco já está ativo.' });
        return;
      }
      // Ativar banco: atualiza status para 'active' (offline persistência respeita)
      questionBankService.updateQuestionBank(bank.id, { status: 'active' })
        .then(() => {
          toast({ description: `Banco "${bank.name}" ativado.` });
          // Recarregar listagem para refletir o novo status
          loadQuestionBanks();
        })
        .catch(() => {
          toast({ description: 'Falha ao ativar banco.', variant: 'destructive' });
        });
    } else if (action === 'view') {
      // Navegar para a página de questões do banco específico
      const bankId = typeof data === 'object' && data?.id ? data.id : data;
      const bank = (questionBanks || []).find(b => b && b.id === bankId);
      if (bank) {
        toast({ description: `Abrindo banco: ${bank.name}` });
      }
      const targetUrl = bankId ? `/questoes?bankId=${encodeURIComponent(bankId)}` : '/questoes';
      window.history.pushState({}, '', targetUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else {
      toast({
        description: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
      });
    }
  };

  const handleClosePopup = () => {
    setIsPopupOpen(false);
    // Comunicar com a página pai (Bubble) para remover blur
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'MODAL_CLOSED' }, '*');
    }
    setFormData({
      name: '',
      description: '',
      tags: [],
      category: '',
      subcategory: ''
    });
    setIsEditMode(false);
    setEditingBank(null);
    setOriginalFormData(null);
    setIsFormModified(false);
  };

  const handleSave = async () => {
    // Exigir autenticação para garantir persistência no Supabase (RLS)
    if (!user) {
      toast({ description: 'Faça login para salvar no Supabase.', variant: 'destructive' });
      return;
    }
    if (!formData.name.trim()) {
      toast({
        description: "Nome do banco de questões é obrigatório",
        variant: "destructive"
      });
      return;
    }
    if (parseMulti(formData.category).length === 0) {
      toast({ description: "Selecione ao menos 1 categoria.", variant: "destructive" });
      return;
    }
    if (parseMulti(formData.subcategory).length === 0) {
      toast({ description: "Selecione ao menos 1 subcategoria.", variant: "destructive" });
      return;
    }

    // Mostrar popup de configuração (apenas para criação)
    if (!isEditMode) {
      setIsSetupModalOpen(true);
    }

    try {
      const questionBankData = {
        name: formData.name.trim(),
        category: formData.category.trim(),
        subcategory: formData.subcategory.trim(),
        // Enviar as tags como array de objetos selecionados
        tags: Array.isArray(formData.tags) ? formData.tags : [],
        description: formData.description.trim()
      };

      if (isEditMode && editingBank?.id) {
        const { data, error } = await questionBankService.updateQuestionBank(editingBank.id, questionBankData);
        if (error) {
          toast({
            description: "Erro ao atualizar banco de questões: " + error,
            variant: "destructive"
          });
        } else {
          setOriginalFormData(JSON.parse(JSON.stringify(formData)));
          setIsFormModified(false);
          toast({ description: "Banco de questões atualizado com sucesso!" });
          loadQuestionBanks();
          if (isSetupModalOpen) setIsSetupModalOpen(false);
          if (!questionBankService.isSupabaseAvailable) {
            toast({ description: 'Sem conexão com Supabase; alterações mantidas localmente.', variant: 'destructive' });
          }
        }
      } else {
        const { data, error } = await questionBankService.createQuestionBank(questionBankData);
        
        if (error) {
          toast({
            description: "Erro ao criar banco de questões: " + error,
            variant: "destructive"
          });
        } else {
          // Resetar estado de modificação após salvar com sucesso
          setOriginalFormData(JSON.parse(JSON.stringify(formData)));
          setIsFormModified(false);
          // Mantemos o modal aberto; apenas ocultamos a div após 5s
          toast({
            description: "Banco de questões criado com sucesso!",
          });
          // Recarregar a lista de bancos de questões
          loadQuestionBanks();

          // Navegar para a página de Questões com o bankId criado
          const bankId = data?.id;
          if (!questionBankService.isSupabaseAvailable) {
            // Supabase indisponível: avisar e não navegar com ID que pode não persistir
            toast({ description: 'Sem conexão com Supabase; banco criado localmente e pode não persistir.', variant: 'destructive' });
            setTimeout(() => setIsSetupModalOpen(false), 5000);
          } else if (bankId) {
            // Ocultar overlay após 5 segundos e navegar com o bankId
            setTimeout(() => {
              setIsSetupModalOpen(false);
              const targetUrl = `/questoes?bankId=${encodeURIComponent(bankId)}`;
              window.history.pushState({}, '', targetUrl);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }, 5000);
          } else {
            // Sem ID, não navegar; apenas fechar overlay
            setTimeout(() => setIsSetupModalOpen(false), 5000);
          }
        }
      }
    } catch (err) {
      if (!isTransientNetworkError(err)) {
        console.error('Error creating question bank:', err);
      }
      toast({
        description: isTransientNetworkError(err) ? "Sem conexão. Tente novamente em instantes." : "Erro ao conectar com o servidor",
        variant: "destructive"
      });
      // Ocultar overlay
      setTimeout(() => setIsSetupModalOpen(false), 5000);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Componente FilterDropdown
  const FilterDropdown = ({ activeFilters, setActiveFilters }) => {
    const statusOptions = ['Todos', 'Ativo', 'Inativo', 'Rascunho'];
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[236px] h-[40px] border-[#E3E4E5] text-[#6B7280] hover:bg-gray-50 px-3 font-inter font-normal text-[14px] flex items-center justify-start" style={{ backgroundColor: '#F8FAFC' }}>
            <div className="flex items-center gap-[5px]">
              <ListFilter className="h-4 w-4" />
              <span style={{ color: '#22252B' }}>
                {activeFilters.status === 'Todos' ? 'Status' : activeFilters.status}
              </span>
            </div>
            <div className="ml-[16px]">
              <ChevronDown className="h-4 w-4" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[236px]">
          {statusOptions.map((option) => (
            <DropdownMenuItem
              key={option}
              onClick={() => setActiveFilters(prev => ({ ...prev, status: option }))}
              className="cursor-pointer"
            >
              {option}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Criar cards de "criar novo" baseado no número de bancos existentes
  // Garantir que sempre tenhamos pelo menos 4 cards de "criar novo" para preencher uma fileira completa
  const createNewCards = Array.from({ length: Math.max(8 - questionBanks.length, 4) }, (_, index) => ({
    id: `create-${index}`,
    type: "create"
  }));

  const filteredBanks = (questionBanks || [])
    .filter((b) => !!b && typeof b.name === 'string')
    .filter(bank => {
      // Filtro por termo de busca
      const matchesSearch = bank.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filtro por status real baseado em bank.status
      const status = bank?.status || 'active';
      const matchesStatus = 
        activeFilters.status === 'Todos' ||
        (activeFilters.status === 'Ativo' && status === 'active') ||
        (activeFilters.status === 'Inativo' && status === 'inactive') ||
        (activeFilters.status === 'Rascunho' && status === 'draft');
      
      return matchesSearch && matchesStatus;
    });

  const displayBanks = [
    ...filteredBanks.map(bank => ({ ...bank, type: "existing" })),
    ...createNewCards
  ];

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Banco de Questões – Connekt</title>
          <meta name="description" content="Gerencie seu banco de questões para simulados." />
        </Helmet>
        <div className="flex flex-col bg-[#F5F6FA]">
          <div className="max-w-[1076px] mx-auto w-full mt-2 sm:mt-4 lg:mt-8 px-4 sm:px-6 relative flex-shrink-0 compact-layout ultra-compact-layout">
            <header className="relative px-4 sm:px-8 pt-4 sm:pt-6 lg:pt-8 pb-4 sm:pb-5 lg:pb-7 bg-[#0B57D0] text-white rounded-[10px] shadow-lg overflow-hidden compact-header ultra-compact-header">
              <div className="relative z-10 space-y-3 animate-pulse">
                <div className="h-[18px] w-[190px] rounded bg-white/25" />
                <div className="h-[14px] w-[420px] max-w-full rounded bg-white/20" />
                <div className="h-[30px] w-[210px] rounded-[4px] bg-white/25" />
              </div>
            </header>
            <DecorativeIcons />
          </div>

          <main className="flex-1 py-2 sm:py-3 lg:py-6 w-full pb-3 sm:pb-4 lg:pb-8 compact-main ultra-compact-main" style={{ minHeight: 0 }}>
            <div className="max-w-[1076px] mx-auto px-4 sm:px-6">
              <div className="mb-3 sm:mb-4 lg:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 compact-spacing ultra-compact-spacing">
                <Skeleton className="w-full sm:w-[328px] h-[40px] rounded-lg" />
                <Skeleton className="w-[240px] h-[40px] rounded-lg" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div
                    key={`bank-skel-${idx}`}
                    className="p-3 sm:p-4 lg:p-6 rounded border shadow-sm flex flex-col min-h-[220px] sm:min-h-[250px] lg:min-h-[295px] w-full overflow-hidden bg-white connekt-fade-in"
                    style={{ borderColor: '#E3E4E5' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Skeleton className="w-12 h-12 rounded-[10px]" />
                      <Skeleton className="w-8 h-8 rounded-[8px]" />
                    </div>
                    <div className="mt-4 space-y-2">
                      <Skeleton className="h-[14px] w-[86%] rounded" />
                      <Skeleton className="h-[12px] w-[64%] rounded" />
                      <Skeleton className="h-[12px] w-[72%] rounded" />
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <Skeleton className="h-[22px] w-[74px] rounded-full" />
                      <Skeleton className="h-[22px] w-[56px] rounded-full" />
                      <Skeleton className="h-[22px] w-[64px] rounded-full" />
                    </div>
                    <div className="mt-auto pt-5 flex items-center justify-between gap-3">
                      <Skeleton className="h-[12px] w-[110px] rounded" />
                      <Skeleton className="h-[28px] w-[90px] rounded-[10px]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Banco de Questões – Connekt</title>
        <meta name="description" content="Gerencie seu banco de questões para simulados." />
      </Helmet>
      <div className="flex flex-col bg-[#F5F6FA]">
        <style dangerouslySetInnerHTML={{
          __html: `
            @media (max-height: 636px) {
              .ultra-compact-layout {
                margin-top: 0 !important;
              }
              .ultra-compact-header {
                padding-top: 0.5rem !important;
                padding-bottom: 0.5rem !important;
              }
              .ultra-compact-main {
                padding-top: 0.25rem !important;
                padding-bottom: 0.25rem !important;
              }
              .ultra-compact-cards {
                min-height: 180px !important;
                padding: 0.375rem !important;
              }
              .ultra-compact-spacing {
                margin-bottom: 0.25rem !important;
              }
              .ultra-compact-text {
                font-size: 0.75rem !important;
                line-height: 1rem !important;
              }
            }
            @media (max-height: 930px) {
              .compact-layout {
                margin-top: 0.25rem !important;
              }
              .compact-header {
                padding-top: 0.75rem !important;
                padding-bottom: 0.75rem !important;
              }
              .compact-main {
                padding-top: 0.5rem !important;
                padding-bottom: 0.5rem !important;
              }
              .compact-cards {
                min-height: 200px !important;
                padding: 0.5rem !important;
              }
              .compact-spacing {
                margin-bottom: 0.5rem !important;
              }
            }
          `
        }} />
        <div className="max-w-[1076px] mx-auto w-full mt-2 sm:mt-4 lg:mt-8 px-4 sm:px-6 relative flex-shrink-0 compact-layout ultra-compact-layout">
          <header className="relative px-4 sm:px-8 pt-4 sm:pt-6 lg:pt-8 pb-4 sm:pb-5 lg:pb-7 bg-[#0B57D0] text-white rounded-[10px] shadow-lg overflow-hidden compact-header ultra-compact-header">
            <div className="relative z-10">
              <h1 className="text-base sm:text-[18px] font-medium font-inter mb-1">Banco de questões</h1>
              <p className="text-sm sm:text-[16px] font-normal font-inter text-blue-100 mb-3 sm:mb-4 lg:mb-6">Crie questões que podem ser usadas em seus simulados.</p>
              <Button onClick={() => handleAction('create')} className="bg-white text-[#0047BB] hover:bg-gray-100 font-semibold px-5 py-2.5 rounded-[4px] shadow-sm w-[210px] h-[30px] text-[14px] font-semibold font-inter flex items-center justify-center">
                Criar banco de questões
              </Button>
            </div>
          </header>
          <DecorativeIcons />
        </div>

        <main className="flex-1 py-2 sm:py-3 lg:py-6 w-full pb-3 sm:pb-4 lg:pb-8 compact-main ultra-compact-main" style={{ minHeight: 0 }}>
          <div className="max-w-[1076px] mx-auto px-4 sm:px-6">
            {/* Main Content */}
            <div className="flex-1">
              <div className="mb-3 sm:mb-4 lg:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 compact-spacing ultra-compact-spacing">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar banco por nome"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-[328px] h-[40px] pl-10 pr-4 py-2 border border-[#E3E4E5] bg-[#F8FAFC] rounded-lg focus:ring-0 text-[14px] font-normal font-inter text-[#ABADB3]"
                  />
                </div>
                <FilterDropdown activeFilters={activeFilters} setActiveFilters={setActiveFilters} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayBanks.map(bank => (
                  bank.type === "existing" ? (
                    <ExistingBankCard key={bank.id} bank={bank} onAction={handleAction} />
                  ) : (
                    <CreateNewBankCard key={bank.id} onAction={handleAction} />
                  )
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Setup Overlay dentro do modal */}

      {/* Popup Modal */}
      {isPopupOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 overflow-y-auto">
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-[800px] max-w-[95vw] max-h-[85vh] overflow-y-auto relative my-8">
            {isSetupModalOpen && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-[272px] h-[138px] bg-white rounded-[8px] p-4 flex flex-col items-center justify-center text-center">
                <Hourglass className="w-8 h-8 text-[#0B57D0] animate-spin" strokeWidth={3} />
                <h3 className="mt-3 text-[16px] font-medium text-gray-900 font-inter">Configurando banco...</h3>
                <p className="mt-2 text-[12px] font-normal text-gray-500 font-inter">
                  Aguarde, estamos criando toda a estrutura do seu banco de questões.
                </p>
              </div>
            )}
            {/* Header */}
            <div className={`flex items-center px-6 py-4 border-b border-gray-200 ${isSetupModalOpen ? 'justify-center' : 'justify-between'}`}>
              <button
                onClick={handleClosePopup}
                className={`p-1 hover:bg-gray-100 rounded transition-colors ${isSetupModalOpen ? 'hidden' : ''}`}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M0 4C0 1.79086 1.79086 0 4 0H16C18.2091 0 20 1.79086 20 4V16C20 18.2091 18.2091 20 16 20H4C1.79086 20 0 18.2091 0 16V4Z" fill="#0063F7"/>
                    <g clipPath="url(#clip0_606_55854)">
                      <path d="M13.75 5.5H6.25C6.05109 5.5 5.86032 5.57902 5.71967 5.71967C5.57902 5.86032 5.5 6.05109 5.5 6.25V13.75C5.5 13.9489 5.57902 14.1397 5.71967 14.2803C5.86032 14.421 6.05109 14.5 6.25 14.5H13.75C13.9489 14.5 14.1397 14.421 14.2803 14.2803C14.421 14.1397 14.5 13.9489 14.5 13.75V6.25C14.5 6.05109 14.421 5.86032 14.2803 5.71967C14.1397 5.57902 13.9489 5.5 13.75 5.5ZM9.51531 11.0153L8.01531 12.5153C7.98049 12.5502 7.93913 12.5778 7.8936 12.5967C7.84808 12.6156 7.79928 12.6253 7.75 12.6253C7.70072 12.6253 7.65192 12.6156 7.6064 12.5967C7.56087 12.5778 7.51951 12.5502 7.48469 12.5153L6.73469 11.7653C6.66432 11.6949 6.62479 11.5995 6.62479 11.5C6.62479 11.4005 6.66432 11.3051 6.73469 11.2347C6.80505 11.1643 6.90049 11.1248 7 11.1248C7.09951 11.1248 7.19495 11.1643 7.26531 11.2347L7.75 11.7198L8.98469 10.4847C9.05505 10.4143 9.15049 10.3748 9.25 10.3748C9.34951 10.3748 9.44495 10.4143 9.51531 10.4847C9.58568 10.5551 9.62521 10.6505 9.62521 10.75C9.62521 10.8495 9.58568 10.9449 9.51531 11.0153ZM9.51531 8.01531L8.01531 9.51531C7.98049 9.55018 7.93913 9.57784 7.8936 9.59671C7.84808 9.61558 7.79928 9.6253 7.75 9.6253C7.70072 9.6253 7.65192 9.61558 7.6064 9.59671C7.56087 9.57784 7.51951 9.55018 7.48469 9.51531L6.73469 8.76531C6.69985 8.73047 6.67221 8.68911 6.65335 8.64359C6.6345 8.59806 6.62479 8.54927 6.62479 8.5C6.62479 8.40049 6.66432 8.30505 6.73469 8.23469C6.80505 8.16432 6.90049 8.12479 7 8.12479C7.09951 8.12479 7.19495 8.16432 7.26531 8.23469L7.75 8.71984L8.98469 7.48469C9.05505 7.41432 9.15049 7.37479 9.25 7.37479C9.34951 7.37479 9.44495 7.41432 9.51531 7.48469C9.58568 7.55505 9.62521 7.65049 9.62521 7.75C9.62521 7.84951 9.58568 7.94495 9.51531 8.01531ZM13 11.875H10.75C10.6505 11.875 10.5552 11.8355 10.4848 11.7652C10.4145 11.6948 10.375 11.5995 10.375 11.5C10.375 11.4005 10.4145 11.3052 10.4848 11.2348C10.5552 11.1645 10.6505 11.125 10.75 11.125H13C13.0995 11.125 13.1948 11.1645 13.2652 11.2348C13.3355 11.3052 13.375 11.4005 13.375 11.5C13.375 11.5995 13.3355 11.6948 13.2652 11.7652C13.1948 11.8355 13.0995 11.875 13 11.875ZM13 8.875H10.75C10.6505 8.875 10.5552 8.83549 10.4848 8.76516C10.4145 8.69484 10.375 8.59946 10.375 8.5C10.375 8.40054 10.4145 8.30516 10.4848 8.23484C10.5552 8.16451 10.6505 8.125 10.75 8.125H13C13.0995 8.125 13.1948 8.16451 13.2652 8.23484C13.3355 8.30516 13.375 8.40054 13.375 8.5C13.375 8.59946 13.3355 8.69484 13.2652 8.76516C13.1948 8.83549 13.0995 8.875 13 8.875Z" fill="#F9FAFB"/>
                    </g>
                    <defs>
                      <clipPath id="clip0_606_55854">
                        <rect width="12" height="12" fill="white" transform="translate(4 4)"/>
                      </clipPath>
                    </defs>
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {isEditMode ? 'Editar banco de questões' : 'Criar novo banco de questões'}
                </h2>
              </div>
              <Button
                onClick={handleSave}
                className={`px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md font-medium disabled:bg-gray-300 disabled:cursor-not-allowed ${isSetupModalOpen ? 'hidden' : ''}`}
                disabled={!isFormModified}
              >
                {isEditMode ? 'Salvar' : 'Criar banco'}
              </Button>
            </div>

            {/* Content (mantém altura; desativa interação quando a div de setup estiver visível) */}
            <div className={`p-8 pb-12 space-y-8 max-w-[600px] mx-auto ${isSetupModalOpen ? 'opacity-0 pointer-events-none select-none' : ''}`}>
              {/* Illustration */}
              <div className="flex justify-start mb-8">
                <img src="/bank-icon.svg" alt="Bank Icon" className="w-20 h-20 mb-6" />
              </div>

              {/* Form Fields */}
              <div className="space-y-6">
                {/* Nome do banco */}
                <div>
                  <input
                    type="text"
                    placeholder="Digite o nome do banco"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full border-none bg-transparent outline-none text-2xl font-medium placeholder-[#ABADB3]"
                    style={{ 
                      fontFamily: 'Inter', 
                      fontWeight: 500, 
                      fontSize: '24px', 
                      color: '#ABADB3' 
                    }}
                  />
                </div>

                {/* Categoria */}
                <div className="mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <img src="/icons/categorias-popup.svg" alt="Categoria" width="14" height="14" className="text-gray-600" />
                      <span
                        style={{
                          fontFamily: 'Inter',
                          fontSize: '14px',
                          fontWeight: 400,
                          color: '#737780',
                        }}
                      >
                        Categoria:
                      </span>
                    </div>

                    <div className="flex-1 flex items-center" style={{ width: 'fit-content', height: 'fit-content' }}>
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedCategoryNames.map((name) => {
                          const cat = (categories || []).find((c) => c?.name === name);
                          const color = cat?.color || '#AD89F7';
                          return (
                            <span
                              key={name}
                              className="px-2 py-1 text-xs font-medium rounded flex items-center gap-1"
                              style={{
                                backgroundColor: 'rgba(173, 137, 247, 0.1)',
                                color,
                                fontFamily: 'Inter',
                                fontSize: '12px',
                                fontWeight: 500,
                              }}
                            >
                              <div className="w-[10px] h-[10px]" style={{ backgroundColor: color }}></div>
                              {name}
                              <button
                                onClick={() => setFormData(prev => ({ ...prev, category: removeFromMulti(prev.category, name) }))}
                                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors ml-1"
                                style={{ color }}
                                aria-label="Remover"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}

                        <div className="relative dropdown-container">
                          <button
                            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                            style={{ background: 'none' }}
                            aria-label="Adicionar categoria"
                          >
                            <Plus className="w-4 h-4 text-gray-600" />
                          </button>

                          {showCategoryDropdown && (
                            <div
                              ref={categoryDropdownRef}
                              className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[250px] max-h-80 overflow-y-auto"
                            >
                              <div className="p-3">
                                <div className="mb-3">
                                  <input
                                    type="text"
                                    placeholder="Pesquisar categorias..."
                                    value={categorySearchTerm}
                                    onChange={(e) => setCategorySearchTerm(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    style={{
                                      fontFamily: 'Inter',
                                      fontSize: '14px',
                                    }}
                                    autoFocus
                                  />
                                </div>

                                <div className="max-h-40 overflow-y-auto">
                                  {selectableCategories.map((category) => (
                                    <div key={category.id} className="px-3 py-2 rounded-md transition-colors">
                                      {editingCategoryId === category.id ? (
                                        <div className="space-y-2">
                                          <input
                                            type="text"
                                            placeholder="Nome da categoria"
                                            value={editCategoryName}
                                            onChange={(e) => setEditCategoryName(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                          />
                                          <div className="flex items-center gap-2">
                                            <label className="text-sm text-gray-600 font-medium" style={{ fontFamily: 'Inter', fontSize: '12px' }}>
                                              Cor:
                                            </label>
                                            <input
                                              type="color"
                                              value={editCategoryColor}
                                              onChange={(e) => setEditCategoryColor(e.target.value)}
                                              className="w-8 h-8 border border-gray-200 rounded cursor-pointer"
                                            />
                                            <div
                                              className="w-4 h-4 rounded-full border border-gray-200"
                                              style={{ backgroundColor: editCategoryColor }}
                                            ></div>
                                          </div>
                                          <textarea
                                            placeholder="Descrição da categoria"
                                            value={editCategoryDescription}
                                            onChange={(e) => setEditCategoryDescription(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                            style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                            rows="2"
                                          />
                                          <div className="flex gap-2">
                                            <button
                                              onClick={handleSaveEditCategory}
                                              disabled={!editCategoryName.trim() || !editCategoryDescription.trim()}
                                              className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                              style={{ fontFamily: 'Inter', fontSize: '12px' }}
                                            >
                                              Salvar
                                            </button>
                                            <button
                                              onClick={handleCancelEditCategory}
                                              className="flex-1 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                                              style={{ fontFamily: 'Inter', fontSize: '12px' }}
                                            >
                                              Cancelar
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        pendingDeleteCategoryId === category.id ? (
                                          <div className="flex items-center gap-2 rounded-md">
                                            <div
                                              className="flex items-center gap-2 flex-1 text-left px-3 py-2 text-sm"
                                              style={{ fontFamily: 'Inter', fontSize: '14px', color: '#374151' }}
                                            >
                                              <div
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: category.color }}
                                              ></div>
                                              <div className="flex-1">
                                                <div className="font-medium">{category.name}</div>
                                                <div className="text-xs text-gray-500 mt-0.5">{category.description}</div>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1 pr-2">
                                              <span className="text-xs text-gray-500 mr-1" style={{ fontFamily: 'Inter' }}>
                                                Remover?
                                              </span>
                                              <button
                                                onClick={() => handleDeleteCategory(category.id)}
                                                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors"
                                                title="Confirmar remoção"
                                                aria-label="Confirmar remoção"
                                              >
                                                <Check className="w-3 h-3 text-red-600" />
                                              </button>
                                              <button
                                                onClick={() => setPendingDeleteCategoryId(null)}
                                                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors"
                                                title="Cancelar"
                                                aria-label="Cancelar"
                                              >
                                                <X className="w-3 h-3 text-gray-600" />
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2 hover:bg-gray-100 rounded-md">
                                            <button
                                              onClick={() => {
                                                setFormData(prev => ({ ...prev, category: addToMulti(prev.category, category.name) }));
                                                setShowCategoryDropdown(false);
                                                setCategorySearchTerm('');
                                              }}
                                              className="flex items-center gap-2 flex-1 text-left px-3 py-2 text-sm"
                                              style={{ fontFamily: 'Inter', fontSize: '14px', color: '#374151' }}
                                            >
                                              <div
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: category.color }}
                                              ></div>
                                              <div className="flex-1">
                                                <div className="font-medium">{category.name}</div>
                                                <div className="text-xs text-gray-500 mt-0.5">{category.description}</div>
                                              </div>
                                            </button>
                                            <div className="flex items-center gap-1 pr-2">
                                              <button
                                                onClick={() => handleStartEditCategory(category)}
                                                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors"
                                                title="Editar"
                                              >
                                                <Pencil className="w-3 h-3 text-gray-600" />
                                              </button>
                                              <button
                                                onClick={() => setPendingDeleteCategoryId(category.id)}
                                                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors"
                                                title="Remover"
                                              >
                                                <Trash className="w-3 h-3 text-red-600" />
                                              </button>
                                            </div>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  ))}

                                  {selectableCategories.length === 0 && categorySearchTerm && (
                                    <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                      Nenhuma categoria encontrada
                                    </div>
                                  )}
                                </div>

                                {selectableCategories.length > 0 && (
                                  <div className="border-t border-gray-200 my-2"></div>
                                )}

                                {!isCreatingNewCategory ? (
                                  <button
                                    onClick={handleStartCreatingCategory}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded-md transition-colors flex items-center gap-2"
                                    style={{
                                      fontFamily: 'Inter',
                                      fontSize: '14px',
                                      color: '#2563eb'
                                    }}
                                  >
                                    <Plus className="w-4 h-4" />
                                    Criar nova categoria
                                  </button>
                                ) : (
                                  <div className="space-y-3">
                                    <input
                                      type="text"
                                      placeholder="Nome da nova categoria"
                                      value={newCategoryName}
                                      onChange={(e) => setNewCategoryName(e.target.value)}
                                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      style={{
                                        fontFamily: 'Inter',
                                        fontSize: '14px'
                                      }}
                                      autoFocus
                                    />

                                    <div className="flex items-center gap-2">
                                      <label className="text-sm text-gray-600 font-medium" style={{ fontFamily: 'Inter', fontSize: '12px' }}>
                                        Cor:
                                      </label>
                                      <input
                                        type="color"
                                        value={newCategoryColor}
                                        onChange={(e) => setNewCategoryColor(e.target.value)}
                                        className="w-8 h-8 border border-gray-200 rounded cursor-pointer"
                                      />
                                      <div
                                        className="w-4 h-4 rounded-full border border-gray-200"
                                        style={{ backgroundColor: newCategoryColor }}
                                      ></div>
                                    </div>

                                    <textarea
                                      placeholder="Descrição da categoria"
                                      value={newCategoryDescription}
                                      onChange={(e) => setNewCategoryDescription(e.target.value)}
                                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                      style={{
                                        fontFamily: 'Inter',
                                        fontSize: '14px'
                                      }}
                                      rows="2"
                                    />

                                    <div className="flex gap-2">
                                      <button
                                        onClick={handleCreateNewCategory}
                                        disabled={!newCategoryName.trim()}
                                        className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                        style={{
                                          fontFamily: 'Inter',
                                          fontSize: '12px'
                                        }}
                                      >
                                        Criar
                                      </button>
                                      <button
                                        onClick={handleCancelNewCategory}
                                        className="flex-1 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                                        style={{
                                          fontFamily: 'Inter',
                                          fontSize: '12px'
                                        }}
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                  <div className="mt-1 text-[12px] text-[#9291A5]">Categorias que serão vinculadas</div>
                </div>

                {/* Subcategoria */}
                <div className="mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 flex items-center gap-2" style={{ width: 'fit-content', height: 'fit-content' }}>
                      <img src="/icons/subcategoria-popup.svg" alt="Subcategoria" width="14" height="14" className="text-gray-600" />
                      <span
                        style={{
                          fontFamily: 'Inter',
                          fontSize: '14px',
                          fontWeight: 400,
                          color: '#737780',
                        }}
                      >
                        Subcategoria:
                      </span>
                    </div>

                    <div className="flex-1 flex flex-row items-center" style={{ width: 'fit-content', height: 'fit-content' }}>
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedSubcategoryNames.map((name) => {
                          const sub = (subcategories || []).find((s) => s?.name === name);
                          const color = sub?.color || '#22C55E';
                          return (
                            <span
                              key={name}
                              className="px-2 py-1 text-xs font-medium rounded flex items-center gap-1"
                              style={{
                                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                color,
                                fontFamily: 'Inter',
                                fontSize: '12px',
                                fontWeight: 500,
                              }}
                            >
                              <div className="w-[10px] h-[10px]" style={{ backgroundColor: color }}></div>
                              {name}
                              <button
                                onClick={() => setFormData(prev => ({ ...prev, subcategory: removeFromMulti(prev.subcategory, name) }))}
                                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors ml-1"
                                style={{ color }}
                                aria-label="Remover"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}

                        <div className="relative dropdown-container">
                          <button
                            onClick={() => setShowSubcategoryDropdown(!showSubcategoryDropdown)}
                            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                            style={{ background: 'none' }}
                            aria-label="Adicionar subcategoria"
                          >
                            <Plus className="w-4 h-4 text-gray-600" />
                          </button>

                          {showSubcategoryDropdown && (
                            <div className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[260px]">
                              <div className="p-2">
                                <div className="mb-2">
                                  <input
                                    type="text"
                                    placeholder="Buscar subcategoria"
                                    value={subcategorySearchTerm}
                                    onChange={(e) => setSubcategorySearchTerm(e.target.value)}
                                    className="w-full h-[32px] px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                  />
                                </div>

                                <div ref={subcategoryDropdownRef} className="max-h-[220px] overflow-y-auto">
                                  {selectableSubcategories.map((subcategory) => (
                                    <div key={subcategory.id} className="px-1 py-1">
                                      {editingSubcategoryId === subcategory.id ? (
                                        <div className="p-2 border border-gray-200 rounded-md bg-gray-50">
                                          <div className="flex items-center gap-2 mb-2">
                                            <input
                                              type="text"
                                              placeholder="Nome da subcategoria"
                                              value={editSubcategoryName}
                                              onChange={(e) => setEditSubcategoryName(e.target.value)}
                                              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                              style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                            />
                                            <div
                                              className="w-4 h-4 rounded-full border border-gray-200"
                                              style={{ backgroundColor: editSubcategoryColor }}
                                            ></div>
                                          </div>
                                          <textarea
                                            placeholder="Descrição da subcategoria"
                                            value={editSubcategoryDescription}
                                            onChange={(e) => setEditSubcategoryDescription(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                            style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                            rows="2"
                                          />
                                          <div className="flex gap-2 mt-2">
                                            <button
                                              onClick={handleSaveEditSubcategory}
                                              disabled={!editSubcategoryName.trim() || !editSubcategoryDescription.trim()}
                                              className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                              style={{ fontFamily: 'Inter', fontSize: '12px' }}
                                            >
                                              Salvar
                                            </button>
                                            <button
                                              onClick={handleCancelEditSubcategory}
                                              className="flex-1 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                                              style={{ fontFamily: 'Inter', fontSize: '12px' }}
                                            >
                                              Cancelar
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        pendingDeleteSubcategoryId === subcategory.id ? (
                                          <div className="flex items-center gap-2 rounded-md">
                                            <button
                                              onClick={() => {
                                                setFormData(prev => ({ ...prev, subcategory: addToMulti(prev.subcategory, subcategory.name) }));
                                                setShowSubcategoryDropdown(false);
                                                setSubcategorySearchTerm('');
                                              }}
                                              className="flex items-center gap-2 flex-1 text-left px-3 py-2 text-sm"
                                              style={{ fontFamily: 'Inter', fontSize: '14px', color: '#374151' }}
                                            >
                                              <div
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: subcategory.color }}
                                              ></div>
                                              <div className="flex-1">
                                                <div className="font-medium">{subcategory.name}</div>
                                                <div className="text-xs text-gray-500 mt-0.5">{subcategory.description}</div>
                                              </div>
                                            </button>
                                            <div className="flex items-center gap-1 pr-2">
                                              <span className="text-xs text-gray-500 mr-1" style={{ fontFamily: 'Inter' }}>
                                                Remover?
                                              </span>
                                              <button
                                                onClick={() => handleDeleteSubcategory(subcategory.id)}
                                                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors"
                                                title="Confirmar remoção"
                                                aria-label="Confirmar remoção"
                                              >
                                                <Check className="w-3 h-3 text-red-600" />
                                              </button>
                                              <button
                                                onClick={() => setPendingDeleteSubcategoryId(null)}
                                                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors"
                                                title="Cancelar"
                                                aria-label="Cancelar"
                                              >
                                                <X className="w-3 h-3 text-gray-600" />
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2 hover:bg-gray-100 rounded-md">
                                            <button
                                              onClick={() => {
                                                setFormData(prev => ({ ...prev, subcategory: addToMulti(prev.subcategory, subcategory.name) }));
                                                setShowSubcategoryDropdown(false);
                                                setSubcategorySearchTerm('');
                                              }}
                                              className="flex items-center gap-2 flex-1 text-left px-3 py-2 text-sm"
                                              style={{ fontFamily: 'Inter', fontSize: '14px', color: '#374151' }}
                                            >
                                              <div
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: subcategory.color }}
                                              ></div>
                                              <div className="flex-1">
                                                <div className="font-medium">{subcategory.name}</div>
                                                <div className="text-xs text-gray-500 mt-0.5">{subcategory.description}</div>
                                              </div>
                                            </button>
                                            <div className="flex items-center gap-1 pr-2">
                                              <button
                                                onClick={() => handleStartEditSubcategory(subcategory)}
                                                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors"
                                                title="Editar"
                                              >
                                                <Pencil className="w-3 h-3 text-gray-600" />
                                              </button>
                                              <button
                                                onClick={() => setPendingDeleteSubcategoryId(subcategory.id)}
                                                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors"
                                                title="Remover"
                                              >
                                                <Trash className="w-3 h-3 text-red-600" />
                                              </button>
                                            </div>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  ))}

                                  {selectableSubcategories.length === 0 && subcategorySearchTerm && (
                                    <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                      Nenhuma subcategoria encontrada
                                    </div>
                                  )}
                                </div>

                                <div className="border-t border-gray-200 mt-2 mb-2"></div>

                                {isCreatingNewSubcategory ? (
                                  <div className="p-2 bg-gray-50 rounded-md">
                                    <div className="flex items-center gap-2 mb-2">
                                      <input
                                        type="text"
                                        placeholder="Nome da subcategoria"
                                        value={newSubcategoryName}
                                        onChange={(e) => setNewSubcategoryName(e.target.value)}
                                        className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                      />
                                      <div
                                        className="w-4 h-4 rounded-full border border-gray-200"
                                        style={{ backgroundColor: newSubcategoryColor }}
                                      ></div>
                                    </div>
                                    <textarea
                                      placeholder="Descrição da subcategoria"
                                      value={newSubcategoryDescription}
                                      onChange={(e) => setNewSubcategoryDescription(e.target.value)}
                                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                      style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                      rows="2"
                                    />
                                    <div className="flex gap-2 mt-2">
                                      <button
                                        onClick={handleCreateNewSubcategory}
                                        disabled={!newSubcategoryName.trim() || !newSubcategoryDescription.trim()}
                                        className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                        style={{ fontFamily: 'Inter', fontSize: '12px' }}
                                      >
                                        Criar
                                      </button>
                                      <button
                                        onClick={handleCancelNewSubcategory}
                                        className="flex-1 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                                        style={{ fontFamily: 'Inter', fontSize: '12px' }}
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setIsCreatingNewSubcategory(true)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md transition-colors"
                                    style={{ fontFamily: 'Inter', fontSize: '14px', color: '#374151' }}
                                  >
                                    + Criar nova subcategoria
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 text-[12px] text-[#9291A5]">Subcategorias que serão vinculadas</div>
                </div>

                {/* Seção de Tags */}
                <div className="mb-6 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 flex items-center gap-2" style={{ width: 'fit-content' }}>
                      <img src="/icons/tag-popup.svg" alt="Tags" width="14" height="14" className="text-gray-600" />
                      <span
                        style={{
                          fontFamily: 'Inter',
                          fontSize: '14px',
                          fontWeight: 400,
                          color: '#737780',
                        }}
                      >
                        Tags:
                      </span>
                    </div>

                    <div className="flex-1 flex flex-row items-center" style={{ width: 'fit-content', height: 'fit-content' }}>
                      {(() => {
                        const unselectedTags = availableTags.filter(tag =>
                          !(formData.tags || []).some(selectedTag => selectedTag && selectedTag.id === tag.id)
                        );
                        return unselectedTags.length > 0;
                      })() && (
                        <div className="relative dropdown-container">
                          <button
                            onClick={() => setShowTagsDropdown(!showTagsDropdown)}
                            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                            style={{ background: 'none' }}
                          >
                            <Plus className="w-4 h-4 text-gray-600" />
                          </button>

                          {showTagsDropdown && (
                            <div className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[260px]">
                              <div className="p-2">
                              {/* Busca */}
                              <div className="mb-2">
                                <input
                                  type="text"
                                  placeholder="Buscar tag"
                                  value={tagsSearchTerm}
                                  onChange={(e) => setTagsSearchTerm(e.target.value)}
                                  className="w-full h-[32px] px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                  style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                />
                              </div>

                              {/* Lista */}
                              <div ref={tagsDropdownRef} className="max-h-[220px] overflow-y-auto">
                                {filteredTags
                                  .filter(tag => !(formData.tags || []).some(selectedTag => selectedTag && selectedTag.id === tag.id))
                                  .map((tag) => (
                                    <div key={tag.id} className="px-1 py-1">
                                      {editingTagId === tag.id ? (
                                        <div className="p-2 border border-gray-200 rounded-md bg-gray-50">
                                          <div className="flex items-center gap-2 mb-2">
                                            <input
                                              type="text"
                                              placeholder="Nome da tag"
                                              value={editTagName}
                                              onChange={(e) => setEditTagName(e.target.value)}
                                              className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                              style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                            />
                                            <div
                                              className="w-4 h-4 rounded-full border border-gray-200"
                                              style={{ backgroundColor: editTagColor }}
                                            ></div>
                                          </div>
                                          <textarea
                                            placeholder="Descrição da tag"
                                            value={editTagDescription}
                                            onChange={(e) => setEditTagDescription(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                            style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                            rows="2"
                                          />
                                          <div className="flex gap-2 mt-2">
                                            <button
                                              onClick={handleSaveEditTag}
                                              disabled={!editTagName.trim() || !editTagDescription.trim()}
                                              className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                              style={{ fontFamily: 'Inter', fontSize: '12px' }}
                                            >
                                              Salvar
                                            </button>
                                            <button
                                              onClick={handleCancelEditTag}
                                              className="flex-1 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                                              style={{ fontFamily: 'Inter', fontSize: '12px' }}
                                            >
                                              Cancelar
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        pendingDeleteTagId === tag.id ? (
                                          <div className="flex items-center gap-2 rounded-md">
                                            <button
                                              onClick={() => {
                                                const isAlreadySelected = (formData.tags || []).some(selectedTag => selectedTag && selectedTag.id === tag.id);
                                                if (!isAlreadySelected) {
                                                  setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
                                                }
                                                setShowTagsDropdown(false);
                                                setTagsSearchTerm('');
                                              }}
                                              className="flex items-center gap-2 flex-1 text-left px-3 py-2 text-sm"
                                              style={{ fontFamily: 'Inter', fontSize: '14px', color: '#374151' }}
                                            >
                                              <div
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: (tag && tag.color) || '#AD89F7' }}
                                              ></div>
                                              <div className="flex-1">
                                                <div className="font-medium">{tag.name}</div>
                                                <div className="text-xs text-gray-500 mt-0.5">{tag.description}</div>
                                              </div>
                                            </button>
                                            <div className="flex items-center gap-1 pr-2">
                                              <span className="text-xs text-gray-500 mr-1" style={{ fontFamily: 'Inter' }}>
                                                Remover?
                                              </span>
                                              <button
                                                onClick={() => handleDeleteTag(tag.id)}
                                                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors"
                                                title="Confirmar remoção"
                                                aria-label="Confirmar remoção"
                                              >
                                                <Check className="w-3 h-3 text-red-600" />
                                              </button>
                                              <button
                                                onClick={() => setPendingDeleteTagId(null)}
                                                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors"
                                                title="Cancelar"
                                                aria-label="Cancelar"
                                              >
                                                <X className="w-3 h-3 text-gray-600" />
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2 hover:bg-gray-100 rounded-md">
                                            <button
                                              onClick={() => {
                                                const isAlreadySelected = (formData.tags || []).some(selectedTag => selectedTag && selectedTag.id === tag.id);
                                                if (!isAlreadySelected) {
                                                  setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
                                                }
                                                setShowTagsDropdown(false);
                                                setTagsSearchTerm('');
                                              }}
                                              className="flex items-center gap-2 flex-1 text-left px-3 py-2 text-sm"
                                              style={{ fontFamily: 'Inter', fontSize: '14px', color: '#374151' }}
                                            >
                                              <div
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: tag.color }}
                                              ></div>
                                              <div className="flex-1">
                                                <div className="font-medium">{tag.name}</div>
                                                <div className="text-xs text-gray-500 mt-0.5">{tag.description}</div>
                                              </div>
                                            </button>
                                            <div className="flex items-center gap-1 pr-2">
                                              <button
                                                onClick={() => handleStartEditTag(tag)}
                                                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors"
                                                title="Editar"
                                              >
                                                <Pencil className="w-3 h-3 text-gray-600" />
                                              </button>
                                              <button
                                                onClick={() => setPendingDeleteTagId(tag.id)}
                                                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors"
                                                title="Remover"
                                              >
                                                <Trash className="w-3 h-3 text-red-600" />
                                              </button>
                                            </div>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  ))}

                                {/* Mensagem quando não há tags */}
                                {filteredTags.filter(tag => !(formData.tags || []).some(selectedTag => selectedTag && selectedTag.id === tag.id)).length === 0 && tagsSearchTerm && (
                                  <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                    Nenhuma tag encontrada
                                  </div>
                                )}
                              </div>

                              {/* Separador */}
                              <div className="border-t border-gray-200 mt-2 mb-2"></div>

                              {/* Criar nova tag */}
                              {isCreatingNewTag ? (
                                <div className="p-2 bg-gray-50 rounded-md">
                                  <div className="flex items-center gap-2 mb-2">
                                    <input
                                      type="text"
                                      placeholder="Nome da tag"
                                      value={newTagName}
                                      onChange={(e) => setNewTagName(e.target.value)}
                                      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                    />
                                    <div
                                      className="w-4 h-4 rounded-full border border-gray-200"
                                      style={{ backgroundColor: newTagColor }}
                                    ></div>
                                  </div>
                                  <textarea
                                    placeholder="Descrição da tag"
                                    value={newTagDescription}
                                    onChange={(e) => setNewTagDescription(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                    rows="2"
                                  />
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={handleCreateNewTag}
                                      disabled={!newTagName.trim() || !newTagDescription.trim()}
                                      className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                                      style={{ fontFamily: 'Inter', fontSize: '12px' }}
                                    >
                                      Criar
                                    </button>
                                    <button
                                      onClick={handleCancelNewTag}
                                      className="flex-1 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                                      style={{ fontFamily: 'Inter', fontSize: '12px' }}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setIsCreatingNewTag(true)}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded-md transition-colors"
                                  style={{ fontFamily: 'Inter', fontSize: '14px', color: '#374151' }}
                                >
                                  + Criar nova tag
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tags selecionadas */}
                    <div className="flex flex-wrap items-center gap-2">
                      {Array.isArray(formData.tags) && formData.tags.filter(t => !!t && typeof t === 'object').map((tag, index) => (
                        <span 
                          key={tag.id || index}
                          className="px-3 py-1 text-sm flex items-center gap-2"
                          style={{ 
                            backgroundColor: (tag.color || '#AD89F7') + '20', 
                            color: tag.color || '#AD89F7',
                            fontFamily: 'Inter',
                            fontSize: '12px',
                            fontWeight: 500,
                            borderRadius: '4px'
                          }}
                        >
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="12" 
                            height="12" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                            <line x1="7" y1="7" x2="7.01" y2="7"/>
                          </svg>
                          {tag.name || tag}
                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                tags: prev.tags.filter((_, i) => i !== index)
                              }));
                            }}
                            className="ml-1 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                            style={{ color: tag.color || '#AD89F7' }}
                          >
                            <svg 
                              xmlns="http://www.w3.org/2000/svg" 
                              width="10" 
                              height="10" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="currentColor" 
                              strokeWidth="2" 
                              strokeLinecap="round" 
                              strokeLinejoin="round"
                            >
                              <line x1="18" y1="6" x2="6" y2="18"/>
                              <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-1 text-[12px] text-[#9291A5]">Tags que serão vinculadas</div>
              </div>

                {/* Descrição */}
                <div>
                  <textarea
                    placeholder="Digite aqui uma descrição para o seu banco de questões"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={6}
                    className="w-full px-4 py-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 placeholder-gray-400 resize-none"
                  />
                  <div className="text-right text-sm text-gray-400 mt-2">
                    {formData.description.length}/300
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default QuestionBankPage;
