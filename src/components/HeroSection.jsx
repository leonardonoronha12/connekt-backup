import React from 'react';

const HeroSection = () => {
  return (
    <div 
      className="flex flex-col items-center justify-center min-h-screen bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `url('https://f1925bd3031c7289927c33dbfff0ab8f.cdn.bubble.io/cdn-cgi/image/w=768,h=1475,f=auto,dpr=2,fit=cover/f1756911386774x642750844897677100/b92b9048fc35d80b9e337d6b4486efaf857b4794.png')`,
        backgroundColor: 'rgba(255, 255, 255, 0)'
      }}
    >
      {/* Logo Container */}
      <div className="flex items-center justify-center p-8">
        <img 
          src="https://f1925bd3031c7289927c33dbfff0ab8f.cdn.bubble.io/f1756911553447x294420453444362900/HORIZONTAL%20BRANCO.svg"
          alt="Logo Horizontal Branco"
          className="max-w-full h-auto"
        />
      </div>
    </div>
  );
};

export default HeroSection;