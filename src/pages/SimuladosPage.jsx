import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { FileText, Plus, ChevronDown, MoreVertical } from 'lucide-react';

const simuladosMock = [
  {
    id: 1,
    name: 'Nome do simulado',
    status: 'Publicado',
    categories: ['Categoria', 'Categoria'],
    approval: 60
  },
  {
    id: 2,
    name: 'Nome do simulado',
    status: 'Publicado',
    categories: ['Categoria', 'Categoria'],
    approval: 60
  }
];

const SimuladosPage = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [coverImage, setCoverImage] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(null);
  const [isCoverPopupOpen, setIsCoverPopupOpen] = useState(false);
  const [coverTab, setCoverTab] = useState('padrao'); // 'padrao' | 'upload'
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadIntervalRef = useRef(null);

  // Gerenciar URL de preview para o arquivo selecionado
  useEffect(() => {
    let url = null;
    if (coverImage && coverImage instanceof File) {
      url = URL.createObjectURL(coverImage);
      setCoverPreviewUrl(url);
    } else if (typeof coverImage === 'string') {
      setCoverPreviewUrl(coverImage);
    } else {
      setCoverPreviewUrl(null);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [coverImage]);
  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleOpenFileDialog = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setCoverImage(file);
      // Iniciar upload simulado: preenche o anel e sobe porcentagem até 100%
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
        uploadIntervalRef.current = null;
      }
      setIsUploading(true);
      setUploadProgress(0);
      const totalDurationMs = 2500; // ~2.5s até 100%
      const tickMs = 50;
      const step = 100 / (totalDurationMs / tickMs);
      uploadIntervalRef.current = setInterval(() => {
        setUploadProgress((prev) => {
          const next = Math.min(100, prev + step);
          if (next >= 100) {
            clearInterval(uploadIntervalRef.current);
            uploadIntervalRef.current = null;
            // pequena pausa para mostrar 100% antes de concluir
            setTimeout(() => {
              setIsUploading(false);
            }, 500);
          }
          return next;
        });
      }, tickMs);
    }
  };

  const handleCreateSimulado = () => {
    // Abrir modal de criação de simulado
    setIsCreateModalOpen(true);
  };

  // Estado para abrir/fechar o grupo de configurações dentro da barra direita
  const [isSettingsPopupOpen, setIsSettingsPopupOpen] = useState(false);
  // Estado dos seis switches do painel de configurações
  const [panelSwitches, setPanelSwitches] = useState([false, false, false, false, false, false]);

  const renderApprovalIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047BB" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2 a10 10 0 0 1 0 20" /></svg>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FB] overflow-y-auto">
      <Helmet>
        <title>Simulados – Connekt</title>
      </Helmet>

      <div className="px-[22px]">
      <div className="max-w-[1904px] mx-auto w-full mt-4">
          {/* Hero Header */}
        <div className="relative w-[1076px] mx-auto grid grid-cols-1 md:grid-cols-[1fr,254px] gap-0">
            {/* Left hero card - idêntico ao header do Banco de Questões */}
      <div className="relative pl-[42px] pr-[42px] pt-[22px] pb-[22px] bg-[#003a99] text-white rounded-[10px] shadow-lg overflow-visible compact-header ultra-compact-header w-[800px] h-fit flex flex-col">
              <div className="relative z-10 h-fit flex flex-col gap-[22px]">
                <div className="h-fit">
                  <h1 className="text-base sm:text-[18px] font-medium font-inter mb-0 h-[37px]">Simulados</h1>
                  <p className="text-sm sm:text-[16px] font-normal font-inter text-blue-100 mb-0 h-[30px]">Crie e gerencie os seus simulados interativos</p>
                </div>
                <button
                  onClick={handleCreateSimulado}
                  className="ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-white text-[#0047BB] hover:bg-gray-100 px-5 py-2.5 rounded-[4px] shadow-sm w-[135px] h-[30px] text-[14px] font-semibold font-inter flex items-center justify-center"
                >
                  Criar simulado
                </button>
              </div>
              {/* SVG decorativo como no Banco de Questões */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="188"
                height="150"
                viewBox="0 0 188 150"
                fill="none"
                className="absolute -top-1 sm:-top-2 lg:-top-3 right-4 sm:right-6 lg:right-10 w-[188px] h-[150px] transform rotate-0 translate-x-[15px] z-50 pointer-events-none"
              >
                <path d="M122 77.7098C122 71.2427 127.243 66 133.71 66H175.691C182.158 66 187.4 71.2426 187.4 77.7098V119.691C187.4 126.158 182.158 131.4 175.691 131.4H133.71C127.243 131.4 122 126.158 122 119.691V77.7098Z" fill="#E051B3" />
                <g clipPath="url(#clip0_93_850)">
                  <path d="M168.189 85.2114H141.211C140.561 85.2114 139.937 85.4698 139.477 85.9298C139.017 86.3897 138.759 87.0135 138.759 87.6639V109.737C138.759 110.387 139.017 111.011 139.477 111.471C139.937 111.931 140.561 112.189 141.211 112.189H143.264C143.496 112.189 143.723 112.123 143.919 111.999C144.116 111.875 144.272 111.698 144.372 111.489C144.968 110.23 145.91 109.166 147.087 108.421C148.264 107.676 149.628 107.281 151.021 107.281C152.414 107.281 153.779 107.676 154.956 108.421C156.133 109.166 157.074 110.23 157.671 111.489C157.77 111.698 157.927 111.875 158.123 111.999C158.32 112.123 158.547 112.189 158.779 112.189H168.189C168.839 112.189 169.463 111.931 169.923 111.471C170.383 111.011 170.641 110.387 170.641 109.737V87.6639C170.641 87.0135 170.383 86.3897 169.923 85.9298C169.463 85.4698 168.839 85.2114 168.189 85.2114ZM151.021 104.832C150.051 104.832 149.103 104.544 148.296 104.005C147.49 103.466 146.861 102.7 146.49 101.804C146.118 100.907 146.021 99.9211 146.211 98.9696C146.4 98.0181 146.867 97.1441 147.553 96.4581C148.239 95.7722 149.113 95.305 150.064 95.1157C151.016 94.9265 152.002 95.0236 152.898 95.3949C153.795 95.7661 154.561 96.3948 155.1 97.2014C155.639 98.0081 155.926 98.9564 155.926 99.9265C155.926 101.227 155.41 102.475 154.49 103.395C153.57 104.315 152.322 104.832 151.021 104.832ZM168.189 109.737H159.518C158.983 108.815 158.302 107.986 157.501 107.284H164.51C164.835 107.284 165.147 107.155 165.377 106.925C165.607 106.695 165.736 106.383 165.736 106.058V91.3427C165.736 91.0175 165.607 90.7056 165.377 90.4756C165.147 90.2456 164.835 90.1165 164.51 90.1165H144.89C144.565 90.1165 144.253 90.2456 144.023 90.4756C143.793 90.7056 143.664 91.0175 143.664 91.3427V106.058C143.664 106.33 143.754 106.594 143.92 106.809C144.087 107.024 144.32 107.178 144.584 107.246C143.764 107.956 143.068 108.798 142.525 109.737H141.211V87.6639H168.189V109.737Z" fill="#E3E4E5" />
                </g>
                <path d="M0 53.882C0 50.6335 2.63346 48 5.88199 48H26.9696C30.2181 48 32.8516 50.6335 32.8516 53.882V74.9696C32.8516 78.2181 30.2181 80.8516 26.9696 80.8516H5.88199C2.63346 80.8516 0 78.2181 0 74.9696V53.882Z" fill="#EF5E2B" />
                <g clipPath="url(#clip1_93_850)">
                  <path d="M24.3102 71.4465C24.379 71.538 24.421 71.6469 24.4314 71.761C24.4418 71.875 24.4202 71.9897 24.369 72.0922C24.3178 72.1946 24.2391 72.2808 24.1416 72.341C24.0442 72.4011 23.9319 72.433 23.8174 72.4328H9.03418C8.91979 72.4328 8.80766 72.401 8.71035 72.3409C8.61304 72.2807 8.5344 72.1947 8.48324 72.0923C8.43208 71.99 8.41043 71.8755 8.4207 71.7616C8.43098 71.6476 8.47277 71.5388 8.54141 71.4473C9.08683 70.716 9.81417 70.1403 10.6511 69.7773C10.1923 69.3586 9.87089 68.8109 9.72895 68.2063C9.58701 67.6016 9.63121 66.9681 9.85575 66.389C10.0803 65.8099 10.4747 65.3123 10.9871 64.9613C11.4996 64.6104 12.1062 64.4226 12.7273 64.4226C13.3484 64.4226 13.955 64.6104 14.4674 64.9613C14.9799 65.3123 15.3743 65.8099 15.5988 66.389C15.8234 66.9681 15.8676 67.6016 15.7256 68.2063C15.5837 68.8109 15.2622 69.3586 14.8035 69.7773C15.4073 70.0383 15.956 70.4116 16.4204 70.8775C16.8848 70.4116 17.4335 70.0383 18.0373 69.7773C17.5785 69.3586 17.2571 68.8109 17.1152 68.2063C16.9732 67.6016 17.0174 66.9681 17.242 66.389C17.4665 65.8099 17.8609 65.3123 18.3733 64.9613C18.8858 64.6104 19.4924 64.4226 20.1135 64.4226C20.7346 64.4226 21.3412 64.6104 21.8537 64.9613C22.3661 65.3123 22.7605 65.8099 22.985 66.389C23.2096 66.9681 23.2538 67.6016 23.1118 68.2063C22.9699 68.8109 22.6484 69.3586 22.1897 69.7773C23.0305 70.1384 23.7617 70.714 24.3102 71.4465ZM8.6646 64.3021C8.72931 64.3506 8.80295 64.3859 8.88131 64.406C8.95967 64.4261 9.04121 64.4305 9.12129 64.4191C9.20137 64.4076 9.27841 64.3805 9.34801 64.3393C9.41761 64.2981 9.47842 64.2436 9.52695 64.1789C9.89989 63.6816 10.3835 63.278 10.9394 63.0001C11.4954 62.7221 12.1084 62.5774 12.73 62.5774C13.3515 62.5774 13.9646 62.7221 14.5205 63.0001C15.0765 63.278 15.5601 63.6816 15.933 64.1789C15.9904 64.2554 16.0648 64.3175 16.1503 64.3602C16.2358 64.403 16.3302 64.4253 16.4258 64.4253C16.5214 64.4253 16.6157 64.403 16.7013 64.3602C16.7868 64.3175 16.8612 64.2554 16.9186 64.1789C17.2915 63.6816 17.7751 63.278 18.331 63.0001C18.887 62.7221 19.5 62.5774 20.1216 62.5774C20.7431 62.5774 21.3562 62.7221 21.9121 63.0001C22.4681 63.278 22.9517 63.6816 23.3246 64.1789C23.3732 64.2436 23.434 64.2981 23.5037 64.3393C23.5733 64.3805 23.6504 64.4076 23.7305 64.419C23.8107 64.4304 23.8922 64.4259 23.9706 64.4058C24.049 64.3856 24.1226 64.3503 24.1873 64.3017C24.2521 64.2531 24.3066 64.1923 24.3478 64.1226C24.389 64.053 24.416 63.9759 24.4274 63.8958C24.4388 63.8157 24.4343 63.7341 24.4142 63.6557C24.3941 63.5773 24.3587 63.5037 24.3102 63.439C23.7647 62.7079 23.0374 62.1324 22.2005 61.7697C22.6592 61.351 22.9807 60.8034 23.1226 60.1987C23.2646 59.594 23.2203 58.9606 22.9958 58.3815C22.7713 57.8024 22.3769 57.3047 21.8644 56.9538C21.352 56.6028 20.7454 56.415 20.1243 56.415C19.5032 56.415 18.8966 56.6028 18.3841 56.9538C17.8717 57.3047 17.4773 57.8024 17.2527 58.3815C17.0282 58.9606 16.984 59.594 17.1259 60.1987C17.2679 60.8034 17.5893 61.351 18.0481 61.7697C17.4443 62.0307 16.8956 62.4041 16.4312 62.87C15.9668 62.4041 15.4181 62.0307 14.8143 61.7697C15.273 61.351 15.5945 60.8034 15.7364 60.1987C15.8783 59.594 15.8341 58.9606 15.6096 58.3815C15.3851 57.8024 14.9907 57.3047 14.4782 56.9538C13.9658 56.6028 13.3592 56.415 12.7381 56.415C12.117 56.415 11.5104 56.6028 10.9979 56.9538C10.4854 57.3047 10.0911 57.8024 9.86653 58.3815C9.64199 58.9606 9.59779 59.594 9.73973 60.1987C9.88167 60.8034 10.2031 61.351 10.6619 61.7697C9.82102 62.1311 9.08981 62.707 8.54141 63.4397C8.49287 63.5044 8.45756 63.5781 8.43748 63.6564C8.41741 63.7348 8.41296 63.8163 8.4244 63.8964C8.43584 63.9765 8.46294 64.0535 8.50416 64.1231C8.54537 64.1927 8.59989 64.2536 8.6646 64.3021Z" fill="#F9FAFB" />
                </g>
                <path d="M38 108.063C38 103.058 42.0576 99 47.0629 99H79.5544C84.5597 99 88.6173 103.058 88.6173 108.063V140.554C88.6173 145.56 84.5597 149.617 79.5544 149.617H47.0629C42.0576 149.617 38 145.56 38 140.554V108.063Z" fill="#3BC5BD" />
                <g clipPath="url(#clip2_93_850)">
                  <path d="M75.6466 114.818H68.054C67.0472 114.818 66.0816 115.218 65.3696 115.93C64.6577 116.642 64.2577 117.607 64.2577 118.614V129.022C64.261 129.267 64.1715 129.504 64.007 129.686C63.8426 129.867 63.6156 129.98 63.3715 130.001C63.2417 130.009 63.1115 129.991 62.989 129.947C62.8665 129.903 62.7543 129.835 62.6594 129.746C62.5645 129.657 62.4889 129.549 62.4373 129.43C62.3858 129.31 62.3593 129.182 62.3596 129.052V118.614C62.3596 117.607 61.9596 116.642 61.2477 115.93C60.5357 115.218 59.5701 114.818 58.5633 114.818H50.9707C50.719 114.818 50.4776 114.918 50.2996 115.096C50.1216 115.274 50.0216 115.515 50.0216 115.767V132.85C50.0216 133.102 50.1216 133.343 50.2996 133.521C50.4776 133.699 50.719 133.799 50.9707 133.799H59.5123C60.2662 133.799 60.9894 134.098 61.5231 134.631C62.0569 135.163 62.3577 135.886 62.3596 136.639C62.3558 136.833 62.4121 137.023 62.5209 137.184C62.6297 137.344 62.7855 137.467 62.967 137.535C63.111 137.591 63.2664 137.61 63.4197 137.592C63.5731 137.574 63.7197 137.519 63.8468 137.431C63.974 137.344 64.0779 137.227 64.1495 137.09C64.2211 136.953 64.2582 136.801 64.2577 136.647C64.2577 135.891 64.5577 135.167 65.0916 134.633C65.6256 134.099 66.3498 133.799 67.1049 133.799H75.6466C75.8983 133.799 76.1397 133.699 76.3177 133.521C76.4957 133.343 76.5957 133.102 76.5957 132.85V115.767C76.5957 115.515 76.4957 115.274 76.3177 115.096C76.1397 114.918 75.8983 114.818 75.6466 114.818ZM72.7994 129.054H68.086C67.8411 129.057 67.604 128.968 67.4224 128.803C67.2409 128.639 67.1283 128.412 67.1073 128.168C67.0987 128.038 67.1169 127.908 67.1607 127.785C67.2045 127.663 67.273 127.551 67.362 127.456C67.451 127.361 67.5586 127.285 67.6781 127.234C67.7975 127.182 67.9263 127.156 68.0564 127.156H72.7697C73.0147 127.153 73.2517 127.242 73.4333 127.407C73.6149 127.571 73.7275 127.798 73.7485 128.042C73.7571 128.172 73.7389 128.302 73.6951 128.425C73.6513 128.547 73.5827 128.659 73.4937 128.754C73.4047 128.849 73.2972 128.925 73.1777 128.976C73.0583 129.028 72.9295 129.054 72.7994 129.054ZM72.7994 125.258H68.086C67.8411 125.261 67.604 125.171 67.4224 125.007C67.2409 124.843 67.1283 124.616 67.1073 124.371C67.0987 124.242 67.1169 124.111 67.1607 123.989C67.2045 123.866 67.273 123.754 67.362 123.659C67.451 123.564 67.5586 123.489 67.6781 123.437C67.7975 123.386 67.9263 123.359 68.0564 123.36H72.7697C73.0147 123.356 73.2517 123.446 73.4333 123.61C73.6149 123.775 73.7275 124.002 73.7485 124.246C73.7571 124.376 73.7389 124.506 73.6951 124.628C73.6513 124.751 73.5827 124.863 73.4937 124.958C73.4047 125.053 73.2972 125.128 73.1777 125.18C73.0583 125.232 72.9295 125.258 72.7994 125.258ZM72.7994 121.461H68.086C67.8407 121.465 67.603 121.376 67.4209 121.212C67.2389 121.047 67.1259 120.82 67.1049 120.575C67.0963 120.445 67.1145 120.315 67.1583 120.193C67.2021 120.07 67.2707 119.958 67.3597 119.863C67.4487 119.768 67.5562 119.693 67.6757 119.641C67.7951 119.589 67.9239 119.563 68.054 119.563H72.7674C73.0127 119.559 73.2504 119.649 73.4325 119.813C73.6145 119.978 73.7275 120.205 73.7485 120.449C73.7571 120.579 73.7389 120.709 73.6951 120.832C73.6513 120.954 73.5827 121.067 73.4937 121.162C73.4047 121.256 73.2972 121.332 73.1777 121.384C73.0583 121.435 72.9295 121.462 72.7994 121.461Z" fill="#F9FAFB" />
                </g>
                <path d="M58 10.0267C58 4.48909 62.4891 0 68.0267 0H103.973C109.511 0 114 4.48909 114 10.0267V45.9733C114 51.5109 109.511 56 103.973 56H68.0267C62.4891 56 58 51.5109 58 45.9733V10.0267Z" fill="#E5B800" />
                <g clipPath="url(#clip3_93_850)">
                  <path d="M99.65 38.5C99.65 38.7784 99.5394 39.0455 99.3424 39.2424C99.1455 39.4393 98.8785 39.55 98.6 39.55H73.4C73.1215 39.55 72.8544 39.4393 72.6575 39.2424C72.4606 39.0455 72.35 38.7784 72.35 38.5C72.35 38.2215 72.4606 37.9544 72.6575 37.7575C72.8544 37.5606 73.1215 37.45 73.4 37.45H98.6C98.8785 37.45 99.1455 37.5606 99.3424 37.7575C99.5394 37.9544 99.65 38.2215 99.65 38.5ZM99.65 18.55V33.25C99.65 33.8069 99.4287 34.341 99.0349 34.7349C98.6411 35.1287 98.1069 35.35 97.55 35.35H74.45C73.893 35.35 73.3589 35.1287 72.9651 34.7349C72.5712 34.341 72.35 33.8069 72.35 33.25V18.55C72.35 17.993 72.5712 17.4589 72.9651 17.065C73.3589 16.6712 73.893 16.45 74.45 16.45H97.55C98.1069 16.45 98.6411 16.6712 99.0349 17.065C99.4287 17.4589 99.65 17.993 99.65 18.55ZM90.725 25.9C90.7249 25.7312 90.6842 25.565 90.6063 25.4154C90.5284 25.2657 90.4156 25.1371 90.2774 25.0403L85.0274 21.3653C84.8701 21.2551 84.6856 21.1901 84.4939 21.1775C84.3022 21.1649 84.1108 21.2051 83.9404 21.2938C83.77 21.3824 83.6272 21.5161 83.5275 21.6803C83.4278 21.8445 83.375 22.0329 83.375 22.225V29.575C83.375 29.767 83.4278 29.9554 83.5275 30.1196C83.6272 30.2838 83.77 30.4175 83.9404 30.5061C84.1108 30.5948 84.3022 30.635 84.4939 30.6224C84.6856 30.6098 84.8701 30.5448 85.0274 30.4346L90.2774 26.7596C90.4156 26.6628 90.5284 26.5342 90.6063 26.3845C90.6842 26.2349 90.7249 26.0687 90.725 25.9Z" fill="#F9FAFB" />
                </g>
                <defs>
                  <clipPath id="clip0_93_850">
                    <rect width="39.2402" height="39.2402" fill="white" transform="translate(135.08 79.0801)" />
                  </clipPath>
                  <clipPath id="clip1_93_850">
                    <rect width="19.7109" height="19.7109" fill="white" transform="translate(6.57031 54.5703)" />
                  </clipPath>
                  <clipPath id="clip2_93_850">
                    <rect width="30.3704" height="30.3704" fill="white" transform="translate(48.1234 109.124)" />
                  </clipPath>
                  <clipPath id="clip3_93_850">
                    <rect width="33.6" height="33.6" fill="white" transform="translate(69.2 11.2)" />
                  </clipPath>
                </defs>
              </svg>
            </div>
            {/* Right info card (pálido azul) */}
            <div className="bg-[#E7EDFC] text-[#22252B] rounded-[10px] border border-[#D9E6FF] px-4 pt-[22px] pb-[22px] w-[254px] h-[163px] relative z-[60]">
              <div className="space-y-0 p-0">
                <h2 className="text-[14px] font-semibold text-[#22252B] font-inter">Banco de questões</h2>
                <p className="text-[12px] font-normal text-[#22252B] font-inter h-[60px] leading-[30px]">Crie questões que podem ser usadas em seus simulados.</p>
              </div>
              <button onClick={() => navigateTo('/banco-de-questoes')} className="mt-4 bg-white text-[#0047BB] hover:bg-gray-100 font-semibold px-5 py-2 rounded-[4px] shadow-sm w-[210px] mx-auto h-[30px] text-[14px] font-inter flex items-center justify-center text-center">
                Criar banco de questões
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="mt-6 w-[1076px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-[16px] font-semibold text-[#000000] font-inter">Simulados</h3>
              <p className="text-[16px] text-[#404040] font-inter font-normal">Todos os seus simulados</p>
            </div>
            <div className="flex items-center gap-[12px] w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none sm:w-[328px]">
                <img src="/search simulados 1.png" alt="Buscar" className="absolute left-3 top-1/2 -translate-y-1/2 w-[20px] h-[20px] object-contain" />
                <input
                  type="text"
                  placeholder="Buscar simulado"
                  className="w-[328px] h-[40px] pl-10 pr-4 py-2 border border-[#E3E4E5] bg-white rounded-[4px] focus:ring-0 text-[14px] font-normal font-inter text-[#ABADB3] placeholder:text-[#ABADB3]"
                />
              </div>
              <button className="flex items-center gap-2 h-[40px] w-[107px] px-[8.5px] border border-[#E3E4E5] rounded-[4px] bg-[#F8FAFC] text-[#22252B] text-[14px] font-normal hover:bg-gray-50">
                <img src="/Filtro simulados 1.png" alt="Filtrar" className="w-4 h-4 object-contain" />
                Filtrar
                <ChevronDown className="w-4 h-4 text-[#6B7588]" />
              </button>
              <button onClick={handleCreateSimulado} className="bg-[#0047BB] text-[#FFFFFF] hover:bg-[#003a99] font-semibold px-5 py-2.5 rounded-[4px] shadow-sm h-[40px] w-[139px] text-[14px] font-inter">
                Criar simulado
              </button>
            </div>
          </div>

          {/* Grid */}
          <div className="mt-6 w-[1076px] mx-auto grid auto-rows-fr grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[22px]">
            {simuladosMock.map(sim => (
              <div key={sim.id} className="bg-white border border-[#E3E4E5] rounded-[4px] p-4 w-[252.5px] h-[222.17px] flex flex-col">
                <div className="flex items-start justify-between mb-0">
                  <div className="flex items-center gap-2">
                    <img src="/t simulados 1.png" alt="Simulado" className="w-[85px] h-[85px] object-contain" />
                  </div>
                  <div className="flex flex-col items-end gap-4">
                    <button className="w-8 h-8 rounded bg-[#F6F5FA] hover:bg-[#F6F5FA] flex items-center justify-center">
                      <MoreVertical className="w-4 h-4 text-[#737780] -rotate-90" />
                    </button>
                    <span className="inline-flex items-center justify-center w-[64px] h-[18px] px-3 text-[10px] bg-[#E9FFEF] text-[#06C270] rounded-[54px] leading-none font-medium">{sim.status}</span>
                  </div>
                </div>
                <div className="mt-0">
                  <h4 className="text-[12px] font-medium text-[#1E1B39] font-inter">{sim.name}</h4>
                  <p className="text-[10px] text-[#9291A5] font-inter font-[400] mt-1">Descrição breve do simulado</p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {sim.categories.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[12px] font-normal h-[20px] px-2 py-0 rounded-[4px]"
                      style={{ backgroundColor: 'rgba(173,137,247,0.1)', color: '#22252B' }}
                    >
                      <span className="leading-none text-[7px] text-[#AD89F7]">🟪</span>
                      <span className="text-[10px] text-[#22252B] font-normal not-italic">{c}</span>
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[12px] text-[#1E1B39] font-inter font-bold">Aprovação (%)</span>
                  <div className="flex items-center gap-1 text-[#0047BB]">
                    {renderApprovalIcon()}
                    <span className="text-[12px] font-bold text-[#0047BB]">{sim.approval}%</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Placeholders */}
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="bg-white border border-[#E3E4E5] rounded-[4px] p-4 w-[252.5px] h-[222.17px] shadow-sm flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full border border-solid border-[#F6F5FA] bg-[#F6F5FA] flex items-center justify-center">
                  <Plus className="w-5 h-5 text-gray-400" />
                </div>
                <p className="mt-2 text-[12px] text-[#ABADB3] font-inter font-medium text-center">
                  Criar um
                  <br />
                  novo simulado
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Simulado Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsCreateModalOpen(false)}></div>
          <div className="relative bg-[#F6F5FA] rounded-lg shadow-2xl w-[1000px] h-[740px] overflow-y-auto">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-6 h-[59px] border-b border-gray-200 bg-[#FFFFFF]">
              <button
                className="w-8 h-8 rounded flex items-center justify-center text-gray-600 hover:bg-gray-100"
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Fechar"
              >
                ✕
              </button>
              <div className="flex items-center gap-2 text-[#1E1B39]">
                <img src="/Produtos - Cores.png" alt="Produtos - Cores" className="w-[20px] h-[20px] rounded object-cover" />
                <span className="text-[14px] font-semibold text-[#000000]">Criar novo simulado</span>
              </div>
              <div className="flex items-center gap-[12px]">
                <div className="h-[35px] w-[2px] bg-[#E3E4E5]/0" />
                <button className="bg-[#0047BB] text-[#FFFFFF] w-[104px] h-[35px] rounded-[6px] text-[14px] font-semibold flex items-center justify-center">Continuar</button>
              </div>
            </div>

            {/* Content */}
        <div className="pl-6 pr-0 pt-0 pb-0 relative flex gap-0">
          <div className="flex-1 pt-[30px]">
              {/* Cover upload */}
              <div
                className="relative bg-pink-200/60 rounded-[10px] w-[600px] h-[200px] mb-9 mx-auto flex items-end"
                style={{
                  backgroundImage: coverImage ? `url(${coverImage})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <img
                  src="/Produtos - Cores.png"
                  alt="Produtos - Cores"
                  className="absolute left-6 -bottom-5 w-[52px] h-[52px] rounded-md shadow object-cover"
                />
                <button onClick={() => setIsCoverPopupOpen(true)} className="absolute right-6 bottom-4 bg-white text-[#0047BB] px-3 py-0 h-[18px] rounded shadow text-[13px] inline-flex items-center gap-2">
                  <img src="/icone img simulado.png" alt="Ícone simulado" className="w-[15px] h-[15px] object-contain" />
                  <span className="text-[#22252B] text-[12px] font-medium">Upload da capa</span>
                </button>
              </div>
              {isCoverPopupOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center">
                  <div className="absolute inset-0 bg-black/30" onClick={() => setIsCoverPopupOpen(false)}></div>
                  <div className="relative bg-white rounded-[8px] shadow-xl w-[352px] h-fit p-4">
                    {/* Tabs */}
                    <div className="flex items-center gap-6 border-b border-[#E3E4E5] pb-2">
                      <button
                        className={`text-[14px] font-medium ${coverTab === 'padrao' ? 'text-[#0047BB]' : 'text-[#737780]'}`}
                        onClick={() => setCoverTab('padrao')}
                      >
                        Padrão
                      </button>
                      <button
                        className={`text-[14px] font-medium ${coverTab === 'upload' ? 'text-[#0047BB]' : 'text-[#737780]'}`}
                        onClick={() => setCoverTab('upload')}
                      >
                        Upload
                      </button>
                    </div>

                    {/* Content */}
                    {coverTab === 'padrao' ? (
                      <div className="mt-3">
                        <span className="text-[12px] font-medium text-[#22252B]">Paleta de cores</span>
                        <div className="grid grid-cols-5 gap-2 mt-2">
                          {['#E9EEF3','#F97066','#F5D90A','#3CB371','#6DD5F7','#1D4ED8','#003a99','#FFB6C1','#F3F4F6','#111827'].map((c) => (
                            <div key={c} className="w-[60.8px] h-[40px] rounded-md border border-[#E3E4E5]" style={{ backgroundColor: c }}></div>
                          ))}
                        </div>

                        <span className="text-[12px] font-medium text-[#22252B] mt-4 inline-block">Galeria de Imagens</span>
                        <div className="grid grid-cols-5 gap-1 mt-2">
                          {[...Array(9)].map((_, i) => (
                            <img key={i} src="/Produtos - Cores.png" alt="Imagem da galeria" className="w-[60.8px] h-[40px] rounded border border-[#E3E4E5] object-cover" />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3">
                        {isUploading ? (
                          <div className="mt-2 p-6 rounded-md text-center text-[12px] bg-white border-2 border-dashed border-[#0047BB]">
                            <div className="flex flex-col items-center justify-center gap-2">
                              {/* Indicador de progresso estilo anel */}
                              {(() => {
                                const radius = 16;
                                const circumference = 2 * Math.PI * radius;
                                const offset = circumference * (1 - uploadProgress / 100);
                                return (
                                  <div className="relative w-10 h-10">
                                    <svg width="40" height="40" viewBox="0 0 40 40">
                                      <circle cx="20" cy="20" r={radius} stroke="#0047BB" strokeWidth="4" opacity="0.3" fill="none" />
                                      <circle cx="20" cy="20" r={radius} stroke="#0047BB" strokeWidth="4" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 20 20)" />
                                    </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[12px] text-[#22252B]">{Math.round(uploadProgress)}%</span>
                                  </div>
                                );
                              })()}
                              <p className="text-[#22252B]">Carregando...</p>
                            </div>
                          </div>
                        ) : coverImage ? (
                          <div className="mt-2 p-4 rounded-md text-[12px] bg-white border-2 border-dashed border-[#0047BB]">
                            <div className="flex items-center gap-3">
                              <img src={coverPreviewUrl || '/Produtos - Cores.png'} alt={coverImage?.name || 'Capa'} className="w-[120px] h-[80px] rounded object-cover" />
                              <div>
                                <p className="text-[#1E1B39] font-inter font-medium text-[14px]">{coverImage?.name || 'Capa do curso'}</p>
                                <p className="text-[#9291A5] font-inter text-[12px]">Tamanho: {coverImage?.size ? `${(coverImage.size / (1024 * 1024)).toFixed(1)}MB` : '—'}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 p-6 rounded-md text-center text-[12px] bg-white border-2 border-dashed border-[#0047BB] cursor-pointer" onClick={handleOpenFileDialog} role="button" aria-label="Selecionar imagem">
                            <div className="flex flex-col items-center justify-center gap-2">
                              {/* Ícone de upload vindo da pasta public */}
                              <img src="/icone%20backup%20simulados.png" alt="Upload" className="w-[36px] h-[36px]" />
                              <p className="text-[#22252B]">
                                Arraste a capa aqui ou
                                <button type="button" className="text-[#0047BB] underline ml-1" onClick={handleOpenFileDialog}>selecione clicando aqui</button>
                              </p>
                              <p className="text-[#9AA0A6]">Max 10 MB, formato: PNG ou JPEG</p>
                              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileChange} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer actions */}
                    <div className="mt-4 flex items-center justify-between border-t border-[#E3E4E5] pt-4 pl-3">
                      {coverTab !== 'upload' && (
                        <button className="text-[12px] text-[#FF3B3B] font-medium">Remover capa</button>
                      )}
                      <div className="flex items-center gap-2">
                         <button onClick={() => setIsCoverPopupOpen(false)} className="h-[26px] w-[68px] px-3 rounded-[6px] bg-transparent text-[#737780] text-[12px] font-medium border border-[#E3E4E5] flex items-center justify-center text-center">Cancelar</button>
                         <button onClick={() => setIsCoverPopupOpen(false)} className="h-[26px] w-[52px] px-3 rounded-[6px] bg-[#0047BB] text-[#FFFFFF] text-[12px] font-medium flex items-center justify-center text-center">Salvar</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bloco de formulário (estrutura similar ao Banco de Questões) */}
              <div className="space-y-6">
                {/* Nome */}
                <div>
                  <input
                    type="text"
                    placeholder="Digite o nome do simulado aqui"
                    className="w-[544px] h-[30px] text-[24px] font-medium text-[#ABADB3] placeholder:text-[#9aa0a6] border-0 focus:ring-0 text-left leading-[30px] block mx-auto px-0 bg-[#F6F5FA]"
                  />
                </div>

                {/* Metadados */}
                <div className="space-y-4 w-[544px] mx-auto">
                  {/* Categoria */}
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <img src="/icons/categorias-popup.svg" alt="Categoria" width="14" height="14" className="text-gray-600" />
                      <span style={{ fontFamily: 'Inter', fontSize: '14px', fontWeight: 400, color: '#737780' }}>Categoria:</span>
                    </div>
                    <div className="flex-1 flex items-center" style={{ width: 'fit-content', height: 'fit-content' }}>
                      <div className="relative dropdown-container">
                        <button className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors" style={{ background: 'none' }}>
                          <Plus className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Subcategoria */}
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 flex items-center gap-2" style={{ width: 'fit-content', height: 'fit-content' }}>
                      <img src="/icons/subcategoria-popup.svg" alt="Subcategoria" width="14" height="14" className="text-gray-600" />
                      <span style={{ fontFamily: 'Inter', fontSize: '14px', fontWeight: 400, color: '#737780' }}>Subcategoria:</span>
                    </div>
                    <div className="flex-1 flex flex-row items-center" style={{ width: 'fit-content', height: 'fit-content' }}>
                      <div className="relative dropdown-container">
                        <button className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors" style={{ background: 'none' }}>
                          <Plus className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-shrink-0 flex items-center gap-2" style={{ width: 'fit-content' }}>
                      <img src="/icons/tag-popup.svg" alt="Tags" width="14" height="14" className="text-gray-600" />
                      <span style={{ fontFamily: 'Inter', fontSize: '14px', fontWeight: 400, color: '#737780' }}>Tags:</span>
                    </div>
                    <div className="flex-1 flex flex-row items-center" style={{ width: 'fit-content', height: 'fit-content' }}>
                      <div className="relative dropdown-container">
                        <button className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors" style={{ background: 'none' }}>
                          <Plus className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
          <div className="relative w-[544px] mx-auto mt-[22px]">
            <textarea
              rows={5}
              placeholder="Digite aqui uma descrição para o seu simulado..."
              className="w-[544px] h-[160px] border-[1.5px] border-[#E3E4E5] rounded-lg p-4 text-[14px] text-[#404040] placeholder:text-[#9aa0a6] bg-[#F6F5FA] resize-none"
              maxLength={300}
            />
            <div className="absolute right-3 bottom-3 text-[#9291A5] text-[12px]">0/300</div>
          </div>
          </div>
          {/* Sidebar direita */}
          <div className="flex-shrink-0 h-[681px]">
            {/* Barra estreita fixa à direita (oculta quando painel aberto) */}
            {!isSettingsPopupOpen && (
              <div className="h-[681px] w-[44px] bg-[#FFFFFF] border-l border-[#E3E4E5] pt-[24px] flex items-start justify-center">
                <img
                  src="/config simulados.png"
                  alt="Configurar simulados"
                  className="w-[20px] h-[20px] object-contain cursor-pointer"
                  onClick={() => setIsSettingsPopupOpen(prev => !prev)}
                />
              </div>
            )}

            {/* Painel dentro da mesma div (ocupando espaço interno) */}
            {isSettingsPopupOpen && (
              <div className="h-[681px] w-[320px] bg-white border-l border-l-[#E3E4E5] rounded-none overflow-y-auto font-inter">
                <div className="flex items-center justify-between px-4 pt-[12px] pb-[12px] w-[296px] h-[44px] border-b border-[#E3E4E5] bg-[#FFFFFF] mx-auto">
                  <span className="text-[14px] font-semibold text-[#000000] font-inter">Configurações do simulado</span>
                  <button
                    className="w-[32px] h-[32px] rounded-[4px] flex items-center justify-center text-gray-600 bg-[#F6F5FA] hover:bg-gray-100"
                    onClick={() => setIsSettingsPopupOpen(false)}
                    aria-label="Fechar"
                  >
                    <span className="inline-flex items-center justify-center w-[16px] h-[16px] text-[16px] leading-[16px] text-[#6B7588]">✕</span>
                  </button>
                </div>
                <div className="p-4 space-y-3">
                    {/* Perguntas */}
                    <div className="text-[14px] font-normal text-[#22252B]">Perguntas</div>
                    <div className="rounded-[8px] bg-[#F9FAFB] px-[18px] py-[12px] h-[74px] w-[296px] shadow-[0px_1.48px_4.43px_0px_#0D0A2C14] flex items-center justify-between" style={{ border: `1px solid ${panelSwitches[0] ? '#0047BB' : 'var(--Stroke-Default, #E3E4E5)'}` }}>
                    <div>
                    <div className="flex items-center gap-[1px]"><img src="/segunda.png" alt="Segunda" className="w-[14px] h-[14px] object-contain" /><span className="text-[12px] font-medium text-[#22252B]">Segunda chance</span></div>
                    <div className="text-[10px] font-normal text-[#737780]">Oferece uma segunda chance para corrigir<br />erros em questões erradas.</div>
                    </div>
                    <button
                      type="button"
                      className="w-[26.14px] h-[14px]"
                      aria-pressed={panelSwitches[0]}
                      aria-label="Alternar Segunda chance"
                      onClick={() => setPanelSwitches(prev => { const next = [...prev]; next[0] = !next[0]; return next; })}
                    >
                      <img src={panelSwitches[0] ? '/Switch.2.png' : '/Switch.png'} alt="Switch" className="w-full h-full rounded-[10.14px]" />
                    </button>
                  </div>
                    <div className="rounded-[8px] bg-[#F9FAFB] px-[18px] py-[12px] h-[74px] w-[296px] shadow-[0px_1.48px_4.43px_0px_#0D0A2C14] flex items-center justify-between" style={{ border: `1px solid ${panelSwitches[1] ? '#0047BB' : 'var(--Stroke-Default, #E3E4E5)'}` }}>
                    <div>
                    <div className="flex items-center gap-[1px]"><img src="/embaralhar.png" alt="Embaralhar" className="w-[14px] h-[14px] object-contain" /><span className="text-[12px] font-medium text-[#22252B]">Embaralhar questões</span></div>
                    <div className="text-[10px] font-normal text-[#737780] w-[221.86px] h-[28px]">Ordem diferente de questões, o que evita memorização mecânica e reduz cópia.</div>
                    </div>
                    <button
                      type="button"
                      className="w-[26.14px] h-[14px]"
                      aria-pressed={panelSwitches[1]}
                      aria-label="Alternar Embaralhar questões"
                      onClick={() => setPanelSwitches(prev => { const next = [...prev]; next[1] = !next[1]; return next; })}
                    >
                      <img src={panelSwitches[1] ? '/Switch.2.png' : '/Switch.png'} alt="Switch" className="w-full h-full rounded-[10.14px]" />
                    </button>
                  </div>
                    <div className="rounded-[8px] bg-[#F9FAFB] px-[18px] py-[12px] h-[74px] w-[296px] shadow-[0px_1.48px_4.43px_0px_#0D0A2C14] flex items-center justify-between" style={{ border: `1px solid ${panelSwitches[2] ? '#0047BB' : 'var(--Stroke-Default, #E3E4E5)'}` }}>
                    <div>
                    <div className="flex items-center gap-[1px]"><img src="/pular.png" alt="Pular" className="w-[14px] h-[14px] object-contain" /><span className="text-[12px] font-medium text-[#22252B]">Pular questão</span></div>
                    <div className="text-[10px] font-normal text-[#737780]">Avançar sem responder imediatamente<br />e depois retornar.</div>
                    </div>
                    <button
                      type="button"
                      className="w-[26.14px] h-[14px]"
                      aria-pressed={panelSwitches[2]}
                      aria-label="Alternar Pular questão"
                      onClick={() => setPanelSwitches(prev => { const next = [...prev]; next[2] = !next[2]; return next; })}
                    >
                      <img src={panelSwitches[2] ? '/Switch.2.png' : '/Switch.png'} alt="Switch" className="w-full h-full rounded-[10.14px]" />
                    </button>
                  </div>

                  {/* Respostas */}
                    <div className="mt-3 text-[14px] font-normal text-[#22252B]">Respostas</div>
                    <div className="rounded-[8px] bg-[#F9FAFB] px-[18px] py-[12px] h-[74px] w-[296px] shadow-[0px_1.48px_4.43px_0px_#0D0A2C14] flex items-center justify-between" style={{ border: `1px solid ${panelSwitches[3] ? '#0047BB' : 'var(--Stroke-Default, #E3E4E5)'}` }}>
                    <div>
                    <div className="flex items-center gap-[1px]"><img src="/nota.png" alt="Nota" className="w-[14px] h-[14px] object-contain" /><span className="text-[12px] font-medium text-[#22252B]">Nota de aprovação</span></div>
                    <div className="text-[10px] font-normal text-[#737780]">O participante precisa atingir essa pontuação<br />para ser aprovado. Exemplo: 50%.</div>
                    </div>
                    <button
                      type="button"
                      className="w-[26.14px] h-[14px]"
                      aria-pressed={panelSwitches[3]}
                      aria-label="Alternar Nota de aprovação"
                      onClick={() => setPanelSwitches(prev => { const next = [...prev]; next[3] = !next[3]; return next; })}
                    >
                      <img src={panelSwitches[3] ? '/Switch.2.png' : '/Switch.png'} alt="Switch" className="w-full h-full rounded-[10.14px]" />
                    </button>
                  </div>
                    <div className="rounded-[8px] bg-[#F9FAFB] px-[18px] py-[12px] h-[74px] w-[296px] shadow-[0px_1.48px_4.43px_0px_#0D0A2C14] flex items-center justify-between" style={{ border: `1px solid ${panelSwitches[4] ? '#0047BB' : 'var(--Stroke-Default, #E3E4E5)'}` }}>
                    <div>
                    <div className="flex items-center gap-[1px]"><img src="/tentativa.png" alt="Tentativa" className="w-[14px] h-[14px] object-contain" /><span className="text-[12px] font-medium text-[#22252B]">Tentativa</span></div>
                    <div className="text-[10px] font-normal text-[#737780]">Oferece a possibilidade de tentar novamente<br />uma alternativa marcada de forma errada.</div>
                    </div>
                    <button
                      type="button"
                      className="w-[26.14px] h-[14px]"
                      aria-pressed={panelSwitches[4]}
                      aria-label="Alternar Tentativa"
                      onClick={() => setPanelSwitches(prev => { const next = [...prev]; next[4] = !next[4]; return next; })}
                    >
                      <img src={panelSwitches[4] ? '/Switch.2.png' : '/Switch.png'} alt="Switch" className="w-full h-full rounded-[10.14px]" />
                    </button>
                  </div>
                    <div className="rounded-[8px] bg-[#F9FAFB] px-[18px] py-[12px] h-[74px] w-[296px] shadow-[0px_1.48px_4.43px_0px_#0D0A2C14] flex items-center justify-between" style={{ border: `1px solid ${panelSwitches[5] ? '#0047BB' : 'var(--Stroke-Default, #E3E4E5)'}` }}>
                    <div>
                    <div className="flex items-center gap-[1px]"><img src="/mostrar.png" alt="Mostrar" className="w-[14px] h-[14px] object-contain" /><span className="text-[12px] font-medium text-[#22252B]">Mostrar resposta correta</span></div>
                    <div className="text-[10px] font-normal text-[#737780]">O sistema apresenta para o participante a<br />alternativa correta.</div>
                    </div>
                    <button
                      type="button"
                      className="w-[26.14px] h-[14px]"
                      aria-pressed={panelSwitches[5]}
                      aria-label="Alternar Mostrar resposta correta"
                      onClick={() => setPanelSwitches(prev => { const next = [...prev]; next[5] = !next[5]; return next; })}
                    >
                      <img src={panelSwitches[5] ? '/Switch.2.png' : '/Switch.png'} alt="Switch" className="w-full h-full rounded-[10.14px]" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimuladosPage;