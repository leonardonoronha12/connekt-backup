import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

const StudentInfoSidebar = ({ student, isVisible, onClose, filterOptions }) => {

  const getCourseIcon = (tag) => {
    const option = filterOptions.find(f => f.name === tag);
    return option ? option.imageUrl : `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M0 4C0 1.79086 1.79086 0 4 0H16C18.2091 0 20 1.79086 20 4V16C20 18.2091 18.2091 20 16 20H4C1.79086 20 0 18.2091 0 16V4Z" fill="#5B4DEA"/><g clip-path="url(#clip0_580_12066)"><path d="M14.875 13.75C14.875 13.8495 14.8355 13.9448 14.7652 14.0152C14.6948 14.0855 14.5995 14.125 14.5 14.125H5.5C5.40054 14.125 5.30516 14.0855 5.23483 14.0152C5.16451 13.9448 5.125 13.8495 5.125 13.75C5.125 13.6505 5.16451 13.5552 5.23483 13.4848C5.30516 13.4145 5.40054 13.375 5.5 13.375H14.5C14.5995 13.375 14.6948 13.4145 14.7652 13.4848C14.8355 13.5552 14.875 13.6505 14.875 13.75ZM14.875 6.625V11.875C14.875 12.0739 14.796 12.2647 14.6553 12.4053C14.5147 12.546 14.3239 12.625 14.125 12.625H5.875C5.67609 12.625 5.48532 12.546 5.34467 12.4053C5.20402 12.2647 5.125 12.0739 5.125 11.875V6.625C5.125 6.42609 5.20402 6.23532 5.34467 6.09467C5.48532 5.95402 5.67609 5.875 5.875 5.875H14.125C14.3239 5.875 14.5147 5.95402 14.6553 6.09467C14.796 6.23532 14.875 6.42609 14.875 6.625ZM11.6875 9.25C11.6875 9.18975 11.6729 9.13038 11.6451 9.07694C11.6173 9.02349 11.577 8.97754 11.5277 8.94297L9.65266 7.63047C9.59647 7.59111 9.53056 7.56792 9.46211 7.56341C9.39366 7.55891 9.32528 7.57327 9.26443 7.60493C9.20357 7.63659 9.15256 7.68434 9.11696 7.74298C9.08136 7.80162 9.06252 7.8689 9.0625 7.9375V10.5625C9.06252 10.6311 9.08136 10.6984 9.11696 10.757C9.15256 10.8157 9.20357 10.8634 9.26443 10.8951C9.32528 10.9267 9.39366 10.9411 9.46211 10.9366C9.53056 10.9321 9.59647 10.9089 9.65266 10.8695L11.5277 9.55703C11.577 9.52246 11.6173 9.47651 11.6451 9.42306C11.6729 9.36962 11.6875 9.31025 11.6875 9.25Z" fill="#F9FAFB"/></g><defs><clipPath id="clip0_580_12066"><rect width="12" height="12" fill="white" transform="translate(4 4)"/></clipPath></defs></svg>')}`;
  };

  const studentCourses = student?.courses?.filter(course => course.tag === 'Curso') || [];

  return (
    <AnimatePresence>
      {isVisible && student && (
        <motion.aside
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="bg-white p-6 flex-col overflow-y-auto border-l border-[#ebecef] h-full"
          aria-label="Informações do aluno"
        >
          <div className="flex justify-end mb-4">
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Fechar"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="relative w-24 h-24">
                <img className="w-full h-full rounded-full object-cover border-4 border-white shadow-lg" alt={student.name} src={student.avatar_url} />
            </div>
            <h2 className="mt-4 text-lg font-bold text-gray-800">{student.name}</h2>
          </div>

          <div className="mt-8">
            <h3 className="font-medium text-sm text-[#22252B] mb-3">Cursos do aluno</h3>
            <div className="space-y-4">
              {studentCourses.length > 0 ? studentCourses.map((course, index) => {
                const iconUrl = getCourseIcon(course.tag);
                return (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        {iconUrl && <img src={iconUrl} alt={`${course.tag} icon`} className="w-5 h-5" />}
                        <span className="text-sm font-semibold text-gray-700">{course.course_name}</span>
                      </div>
                      <span className="text-sm font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-md">{course.progress}%</span>
                    </div>
                    <Progress value={course.progress} className="h-2" />
                  </div>
                );
              }) : (
                <div className="text-center text-sm text-gray-500 py-4">
                  Nenhum curso encontrado para este aluno.
                </div>
              )}
            </div>
          </div>

          <div className="mt-8">
            <h3 className="font-medium text-sm text-[#22252B] mb-3">Informações do aluno</h3>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-lg bg-blue-100 grid place-items-center mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="10" viewBox="0 0 14 10" fill="none">
                      <path d="M13 0H1C0.867392 0 0.740215 0.0526785 0.646447 0.146447C0.552678 0.240215 0.5 0.367392 0.5 0.5V9C0.5 9.26522 0.605357 9.51957 0.792893 9.70711C0.98043 9.89464 1.23478 10 1.5 10H12.5C12.7652 10 13.0196 9.89464 13.2071 9.70711C13.3946 9.51957 13.5 9.26522 13.5 9V0.5C13.5 0.367392 13.4473 0.240215 13.3536 0.146447C13.2598 0.0526785 13.1326 0 13 0ZM5.16937 5L1.5 8.36312V1.63688L5.16937 5ZM5.90938 5.67813L6.65938 6.36875C6.75162 6.45343 6.87228 6.50041 6.9975 6.50041C7.12272 6.50041 7.24338 6.45343 7.33562 6.36875L8.08562 5.67813L11.7106 9H2.28562L5.90938 5.67813ZM8.83062 5L12.5 1.63625V8.36375L8.83062 5Z" fill="#0047BB"/>
                    </svg>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Email</div>
                  <a href={`mailto:${student.email}`} className="text-sm text-gray-800 font-medium hover:underline">{student.email}</a>
                </div>
              </div>
              {student.whatsapp && (
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-lg bg-green-100 grid place-items-center mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <g clip-path="url(#clip0_182_5445)">
                        <path d="M9.53625 9.07665L10.9738 9.79415C10.9056 10.1346 10.7215 10.4409 10.4527 10.6608C10.1839 10.8806 9.84723 11.0005 9.5 10.9998C8.30693 10.9985 7.16311 10.5239 6.31948 9.68029C5.47585 8.83667 5.00132 7.69284 5 6.49978C4.9999 6.15298 5.11998 5.81685 5.33979 5.54861C5.5596 5.28037 5.86557 5.09658 6.20563 5.02853L6.92312 6.46603L6.3125 7.37478C6.26687 7.44322 6.23883 7.52187 6.23087 7.60375C6.22292 7.68562 6.23528 7.7682 6.26687 7.84415C6.62462 8.69439 7.30101 9.37078 8.15125 9.72853C8.22743 9.76152 8.31063 9.77503 8.39334 9.76783C8.47605 9.76063 8.55567 9.73294 8.625 9.68727L9.53625 9.07665ZM14.5 7.99978C14.5002 9.12198 14.2099 10.2251 13.6574 11.2019C13.1048 12.1786 12.3087 12.9956 11.3467 13.5734C10.3847 14.1512 9.28942 14.4701 8.16759 14.499C7.04575 14.528 5.93554 14.266 4.945 13.7385L2.81687 14.4479C2.64068 14.5067 2.4516 14.5152 2.27083 14.4725C2.09006 14.4299 1.92474 14.3377 1.79341 14.2064C1.66207 14.075 1.56991 13.9097 1.52725 13.7289C1.48459 13.5482 1.49312 13.3591 1.55187 13.1829L2.26125 11.0548C1.79759 10.183 1.53862 9.21714 1.504 8.23038C1.46937 7.24362 1.66 6.26194 2.06142 5.35986C2.46283 4.45777 3.06448 3.65899 3.8207 3.02415C4.57691 2.3893 5.46782 1.93507 6.42579 1.69595C7.38376 1.45682 8.38362 1.43908 9.34948 1.64407C10.3153 1.84906 11.2218 2.27139 12.0001 2.87901C12.7783 3.48662 13.4079 4.26356 13.8411 5.15083C14.2743 6.03811 14.4996 7.01241 14.5 7.99978ZM12 9.49978C12.0001 9.40689 11.9743 9.31581 11.9255 9.23677C11.8767 9.15773 11.8068 9.09384 11.7238 9.05228L9.72375 8.05228C9.64502 8.01304 9.55734 7.99528 9.46955 8.00076C9.38177 8.00625 9.29698 8.0348 9.22375 8.08353L8.30562 8.69603C7.88416 8.46433 7.53732 8.11749 7.30562 7.69603L7.91813 6.7779C7.96685 6.70467 7.9954 6.61988 8.00089 6.5321C8.00637 6.44431 7.98861 6.35663 7.94938 6.2779L6.94938 4.2779C6.90793 4.19419 6.84386 4.12377 6.76444 4.07462C6.68501 4.02546 6.59341 3.99953 6.5 3.99978C5.83696 3.99978 5.20107 4.26317 4.73223 4.73201C4.26339 5.20085 4 5.83673 4 6.49978C4.00165 7.95796 4.58165 9.35594 5.61274 10.387C6.64383 11.4181 8.04182 11.9981 9.5 11.9998C9.8283 11.9998 10.1534 11.9351 10.4567 11.8095C10.76 11.6838 11.0356 11.4997 11.2678 11.2675C11.4999 11.0354 11.6841 11.7598 11.8097 10.4565C11.9353 10.1532 12 9.82808 12 9.49978Z" fill="#06C270"/>
                        </g>
                        <defs>
                        <clipPath id="clip0_182_5445">
                        <rect width="16" height="16" fill="white"/>
                        </clipPath>
                        </defs>
                      </svg>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Whatsapp</div>
                    <a href={`https://wa.me/${student.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-800 font-medium hover:underline">{student.whatsapp}</a>
                  </div>
                </div>
              )}
            </div>
          </div>

        </motion.aside>
      )}
    </AnimatePresence>
  );
};

export default StudentInfoSidebar;