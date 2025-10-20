import React from 'react';
import { motion } from 'framer-motion';

const UnreadAvatarsBar = ({ conversations, onAvatarClick, onToggleStudentInfo }) => {
  return (
    <motion.aside
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="bg-white p-4 flex flex-col items-center gap-4 border-l border-[#ebecef] h-full"
      aria-label="Conversas não lidas"
    >
      <button
        onClick={onToggleStudentInfo}
        className="w-12 h-12 rounded-[14px] bg-transparent grid place-items-center flex-shrink-0 shadow-none focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        aria-label="Abrir/Fechar informações do aluno"
      >
        <img src={`data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none"><g clip-path="url(#clip0_580_1379)"><path d="M23.625 5.25H4.37503C3.9109 5.25 3.46578 5.43437 3.13759 5.76256C2.80941 6.09075 2.62503 6.53587 2.62503 7V24.5C2.62301 24.8337 2.71742 25.1609 2.89689 25.4422C3.07637 25.7236 3.33328 25.9471 3.63675 26.0859C3.868 26.1936 4.11994 26.2496 4.37503 26.25C4.78585 26.249 5.18304 26.1025 5.49613 25.8366L5.50597 25.8289L9.07816 22.75H23.625C24.0892 22.75 24.5343 22.5656 24.8625 22.2374C25.1907 21.9092 25.375 21.4641 25.375 21V7C25.375 6.53587 25.1907 6.09075 24.8625 5.76256C24.5343 5.43437 24.0892 5.25 23.625 5.25ZM17.5 16.625H10.5C10.268 16.625 10.0454 16.5328 9.88131 16.3687C9.71722 16.2046 9.62503 15.9821 9.62503 15.75C9.62503 15.5179 9.71722 15.2954 9.88131 15.1313C10.0454 14.9672 10.268 14.875 10.5 14.875H17.5C17.7321 14.875 17.9547 14.9672 18.1188 15.1313C18.2828 15.2954 18.375 15.5179 18.375 15.75C18.375 15.9821 18.2828 16.2046 18.1188 16.3687C17.9547 16.5328 17.7321 16.625 17.5 16.625ZM17.5 13.125H10.5C10.268 13.125 10.0454 13.0328 9.88131 12.8687C9.71722 12.7046 9.62503 12.4821 9.62503 12.25C9.62503 12.0179 9.71722 11.7954 9.88131 11.6313C10.0454 11.4672 10.268 11.375 10.5 11.375H17.5C17.7321 11.375 17.9547 11.4672 18.1188 11.6313C18.2828 11.7954 18.375 12.0179 18.375 12.25C18.375 12.4821 18.2828 12.7046 18.1188 12.8687C17.9547 13.0328 17.7321 13.125 17.5 13.125Z" fill="#0047BB"/></g><defs><clipPath id="clip0_580_1379"><rect width="28" height="28" fill="white"/></clipPath></defs></svg>')}`} alt="Abrir/Fechar informações do aluno" className="w-7 h-7" />
      </button>
      <div className="flex flex-col gap-4 mt-4">
        {conversations.map((conv) => (
          <motion.button
            key={conv.id}
            onClick={() => onAvatarClick(conv.id)}
            className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={`Abrir conversa com ${conv.student.name}`}
          >
            {conv.student.avatar_url ? (
              <img src={conv.student.avatar_url} alt={conv.student.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold">
                {conv.student.initials}
              </div>
            )}
          </motion.button>
        ))}
      </div>
    </motion.aside>
  );
};

export default UnreadAvatarsBar;