import React from 'react';
import HeroSection from '@/components/HeroSection';
import UploadAndSaveImage from '@/components/UploadAndSaveImage';
import UploadImageSupabaseLog from '@/components/UploadImageSupabaseLog';

const HeroPage = () => {
  return (
    <div>
      <HeroSection />
      <div className="fixed bottom-4 right-4 shadow-lg flex flex-col gap-3 items-end">
        {/* Demo da ação para fácil validação em /hero */}
        <UploadAndSaveImage />
        <UploadImageSupabaseLog />
      </div>
    </div>
  );
};

export default HeroPage;