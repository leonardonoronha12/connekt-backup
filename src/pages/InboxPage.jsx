import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import Sidebar from '@/components/Sidebar';
import ChatArea from '@/components/ChatArea';
import StudentInfoSidebar from '@/components/StudentInfoSidebar';
import UnreadAvatarsBar from '@/components/UnreadAvatarsBar';
import EmptyInbox from '@/components/EmptyInbox';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { useActiveProducerUserId } from '@/hooks/useActiveProducerUserId'

// Função para obter parâmetros da URL
function getUrlParam(name) {
  try { 
    return new URL(window.location.href).searchParams.get(name) || ''; 
  } catch { 
    return ''; 
  }
}

const filterOptions = [
    {
      name: 'Curso',
      courseName: 'Curso de Cirurgia',
      professor: 'Dr. Marcos Albuquerque',
      imageUrl: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M0 4C0 1.79086 1.79086 0 4 0H16C18.2091 0 20 1.79086 20 4V16C20 18.2091 18.2091 20 16 20H4C1.79086 20 0 18.2091 0 16V4Z" fill="#5B4DEA"/><g clip-path="url(#clip0_580_12066)"><path d="M14.875 13.75C14.875 13.8495 14.8355 13.9448 14.7652 14.0152C14.6948 14.0855 14.5995 14.125 14.5 14.125H5.5C5.40054 14.125 5.30516 14.0855 5.23483 14.0152C5.16451 13.9448 5.125 13.8495 5.125 13.75C5.125 13.6505 5.16451 13.5552 5.23483 13.4848C5.30516 13.4145 5.40054 13.375 5.5 13.375H14.5C14.5995 13.375 14.6948 13.4145 14.7652 13.4848C14.8355 13.5552 14.875 13.6505 14.875 13.75ZM14.875 6.625V11.875C14.875 12.0739 14.796 12.2647 14.6553 12.4053C14.5147 12.546 14.3239 12.625 14.125 12.625H5.875C5.67609 12.625 5.48532 12.546 5.34467 12.4053C5.20402 12.2647 5.125 12.0739 5.125 11.875V6.625C5.125 6.42609 5.20402 6.23532 5.34467 6.09467C5.48532 5.95402 5.67609 5.875 5.875 5.875H14.125C14.3239 5.875 14.5147 5.95402 14.6553 6.09467C14.796 6.23532 14.875 6.42609 14.875 6.625ZM11.6875 9.25C11.6875 9.18975 11.6729 9.13038 11.6451 9.07694C11.6173 9.02349 11.577 8.97754 11.5277 8.94297L9.65266 7.63047C9.59647 7.59111 9.53056 7.56792 9.46211 7.56341C9.39366 7.55891 9.32528 7.57327 9.26443 7.60493C9.20357 7.63659 9.15256 7.68434 9.11696 7.74298C9.08136 7.80162 9.06252 7.8689 9.0625 7.9375V10.5625C9.06252 10.6311 9.08136 10.6984 9.11696 10.757C9.15256 10.8157 9.20357 10.8634 9.26443 10.8951C9.32528 10.9267 9.39366 10.9411 9.46211 10.9366C9.53056 10.9321 9.59647 10.9089 9.65266 10.8695L11.5277 9.55703C11.577 9.52246 11.6173 9.47651 11.6451 9.42306C11.6729 9.36962 11.6875 9.31025 11.6875 9.25Z" fill="#F9FAFB"/></g><defs><clipPath id="clip0_580_12066"><rect width="12" height="12" fill="white" transform="translate(4 4)"/></clipPath></defs></svg>')}`
    },
    {
      name: 'Caderno',
      courseName: 'Caderno de Anotações',
      professor: 'Colaborativo',
      imageUrl: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M0 4C0 1.79086 1.79086 0 4 0H16C18.2091 0 20 1.79086 20 4V16C20 18.2091 18.2091 20 16 20H4C1.79086 20 0 18.2091 0 16V4Z" fill="#3BC5BD"/><g clip-path="url(#clip0_580_18890)"><path d="M14.875 6.25H11.875C11.4772 6.25 11.0956 6.40804 10.8143 6.68934C10.533 6.97064 10.375 7.35218 10.375 7.75V11.8623C10.3763 11.9591 10.3409 12.0528 10.276 12.1245C10.211 12.1963 10.1213 12.2408 10.0248 12.2491C9.97355 12.2525 9.9221 12.2453 9.8737 12.228C9.82529 12.2107 9.78096 12.1836 9.74347 12.1484C9.70597 12.1132 9.6761 12.0707 9.65573 12.0235C9.63534 11.9764 9.62489 11.9255 9.625 11.8741V7.75C9.625 7.35218 9.46696 6.97064 9.18566 6.68934C8.90436 6.40804 8.52282 6.25 8.125 6.25H5.125C5.02554 6.25 4.93016 6.28951 4.85983 6.35984C4.78951 6.43016 4.75 6.52554 4.75 6.625V13.375C4.75 13.4745 4.78951 13.5698 4.85983 13.6402C4.93016 13.7105 5.02554 13.75 5.125 13.75H8.5C8.79788 13.75 9.0836 13.8681 9.2945 14.0785C9.5054 14.2889 9.62426 14.5743 9.625 14.8722C9.6235 14.9488 9.64577 15.0239 9.68876 15.0873C9.73174 15.1507 9.79331 15.1992 9.865 15.2261C9.92191 15.2481 9.98332 15.2558 10.0439 15.2487C10.1045 15.2415 10.1624 15.2197 10.2126 15.1851C10.2629 15.1505 10.3039 15.1042 10.3322 15.0502C10.3605 14.9961 10.3752 14.936 10.375 14.875C10.375 14.5766 10.4935 14.2905 10.7045 14.0795C10.9155 13.8685 11.2016 13.75 11.5 13.75H14.875C14.9745 13.75 15.0698 13.7105 15.1402 13.6402C15.2105 13.7105 15.25 13.75 15.25 13.75V6.625C15.25 6.52554 15.2105 6.43016 15.1402 6.35984C15.0698 6.28951 14.9745 6.25 14.875 6.25ZM13.75 11.875H11.8877C11.7909 11.8763 11.6972 11.8409 11.6255 11.776C11.5537 11.711 11.5092 11.6213 11.5009 11.5248C11.4975 11.4735 11.5047 11.4221 11.522 11.3737C11.5393 11.3253 11.5664 11.281 11.6016 11.2435C11.6368 11.206 11.6793 11.1761 11.7265 11.1557C11.7736 11.1353 11.8245 11.1249 11.8759 11.125H13.7383C13.8351 11.1237 13.9287 11.1591 14.0005 11.224C14.0722 11.289 14.1167 11.3787 14.125 11.4752C14.1284 11.5265 14.1212 11.5779 14.1039 11.6263C14.0866 11.6747 14.0595 11.719 14.0244 11.7565C13.9892 11.794 13.9467 11.8239 13.8995 11.8443C13.8523 11.8647 13.8014 11.8751 13.75 11.875ZM13.75 10.375H11.8877C11.7909 10.3763 11.6972 10.3409 11.6255 10.276C11.5537 10.211 11.5092 10.1213 11.5009 10.0248C11.4975 9.97355 11.5047 9.9221 11.522 9.8737C11.5393 9.82529 11.5664 9.78097 11.6016 9.74347C11.6368 9.70597 11.6793 9.6761 11.7265 9.65573C11.7736 9.63535 11.8245 9.62489 11.8759 9.625H13.7383C13.8351 9.6237 13.9287 9.65909 14.0005 9.72405C14.0722 9.78901 14.1167 9.87873 14.125 9.97516C14.1284 10.0265 14.1212 10.0779 14.1039 10.1263C14.0866 10.1747 14.0595 10.219 14.0244 10.2565C13.9892 10.294 13.9467 10.3239 13.8995 10.3443C13.8523 10.3647 13.8014 10.3751 13.75 10.375ZM13.75 8.875H11.8877C11.7907 8.87654 11.6968 8.84126 11.6249 8.77628C11.5529 8.71129 11.5083 8.62144 11.5 8.52484C11.4966 8.47355 11.5038 8.4221 11.5211 8.3737C11.5384 8.32529 11.5655 8.28097 11.6006 8.24347C11.6358 8.20597 11.6783 8.1761 11.7255 8.15573C11.7727 8.13535 11.8236 8.12489 11.875 8.125H13.7373C13.8343 8.12346 13.9282 8.15874 14.0001 8.22372C14.0721 8.28871 14.1167 8.37856 14.125 8.47516C14.1284 8.52645 14.1212 8.5779 14.1039 8.6263C14.0866 8.67471 14.0595 8.71904 14.0244 8.75653C13.9892 8.79403 13.9467 8.8239 13.8995 8.84428C13.8523 8.86466 13.8014 8.87511 13.75 8.875Z" fill="#F9FAFB"/></g><defs><clipPath id="clip0_580_18890"><rect width="12" height="12" fill="white" transform="translate(4 4)"/></clipPath></defs></svg>')}`
    },
    {
      name: 'Comunidade',
      courseName: 'Comunidade Online',
      professor: 'Vários',
      imageUrl: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M0 4C0 1.79086 1.79086 0 4 0H16C18.2091 0 20 1.79086 20 4V16C20 18.2091 18.2091 20 16 20H4C1.79086 20 0 18.2091 0 16V4Z" fill="#EF5E2B"/><g clip-path="url(#clip0_580_10062)"><path d="M14.8 14.2742C14.8419 14.3299 14.8675 14.3962 14.8738 14.4656C14.8801 14.5351 14.867 14.6049 14.8358 14.6673C14.8047 14.7296 14.7567 14.7821 14.6974 14.8187C14.6381 14.8554 14.5697 14.8747 14.5 14.8747H5.5C5.43036 14.8747 5.36209 14.8553 5.30285 14.8187C5.24361 14.7821 5.19573 14.7297 5.16459 14.6674C5.13345 14.6051 5.12026 14.5354 5.12652 14.466C5.13277 14.3966 5.15821 14.3304 5.2 14.2747C5.53206 13.8295 5.97485 13.479 6.48438 13.258C6.20508 13.003 6.00939 12.6697 5.92298 12.3015C5.83656 11.9334 5.86347 11.5478 6.00017 11.1952C6.13687 10.8427 6.37697 10.5397 6.68895 10.326C7.00094 10.1124 7.37023 9.99805 7.74836 9.99805C8.12649 9.99805 8.49578 10.1124 8.80777 10.326C9.11975 10.5397 9.35985 10.8427 9.49655 11.1952C9.63325 11.5478 9.66015 11.9334 9.57374 12.3015C9.48733 12.6697 9.29164 13.003 9.01234 13.258C9.37995 13.4168 9.714 13.6442 9.99672 13.9278C10.2794 13.6442 10.6135 13.4168 10.9811 13.258C10.7018 13.003 10.5061 12.6697 10.4197 12.3015C10.3333 11.9334 10.3602 11.5478 10.4969 11.1952C10.6336 10.8427 10.8737 10.5397 11.1857 10.326C11.4977 10.1124 11.867 9.99805 12.2451 9.99805C12.6232 9.99805 12.9925 10.1124 13.3045 10.326C13.6165 10.5397 13.8566 10.8427 13.9933 11.1952C14.13 11.5478 14.1569 11.9334 14.0705 12.3015C13.984 12.6697 13.7884 13.003 13.5091 13.258C14.021 13.4778 14.4661 13.8282 14.8 14.2742ZM5.275 9.92467C5.3144 9.95422 5.35923 9.97572 5.40693 9.98794C5.45464 10.0002 5.50428 10.0029 5.55303 9.9959C5.60178 9.98894 5.64869 9.97244 5.69106 9.94735C5.73343 9.92226 5.77045 9.88907 5.8 9.84967C6.02705 9.54695 6.32146 9.30124 6.65992 9.13201C6.99838 8.96278 7.37159 8.87467 7.75 8.87467C8.12841 8.87467 8.50162 8.96278 8.84008 9.13201C9.17854 9.30124 9.47295 9.54695 9.7 BatchNorm_6234967C9.73493 9.89625 9.78022 9.93405 9.83229 9.96008C9.88437 9.98612 9.94178 9.99967 10 9.99967C10.0582 9.99967 10.1156 9.98612 10.1677 9.96008C10.2198 9.93405 10.2651 9.89625 10.3 9.84967C10.527 9.54695 10.8215 9.30124 11.1599 9.13201C11.4984 8.96278 11.8716 8.87467 12.25 8.87467C12.6284 8.87467 13.0016 8.96278 13.3401 9.13201C13.6785 9.30124 13.973 9.54695 14.2 9.84967C14.2296 9.88907 14.2666 9.92226 14.309 9.94733C14.3514 9.97241 14.3984 9.98889 14.4471 9.99584C14.4959 10.0028 14.5456 10 14.5933 9.9878C14.6410 9.97555 14.6858 9.95402 14.7252 9.24444C14.7646 9.89486 14.7978 9.85781 14.8229 9.81541C14.848 9.77301 14.8645 9.72608 14.8714 9.67731C14.8783 9.62853 14.8756 9.57887 14.8634 9.53115C14.8511 9.48344 14.8296 9.4386 14.8 9.3992C14.4679 8.95414 14.0251 8.60377 13.5156 8.38295C13.7949 8.12805 13.9906 7.79466 14.077 7.42653C14.1634 7.05841 14.1365 6.67276 13.9998 6.32021C13.8631 5.96766 13.623 5.66467 13.311 5.45102C12.9991 5.23737 12.6298 5.12305 12.2516 5.12305C11.8735 5.12305 11.5042 5.23737 11.1922 5.45102C10.8802 5.66467 10.6402 5.96766 10.5035 6.32021C10.3668 6.67276 10.3398 7.05841 10.4263 7.42653C10.5127 7.79466 10.7084 8.12805 10.9877 8.38295C10.6201 8.54185 10.286 8.76916 10.0033 9.0528C9.72056 8.76916 9.38651 8.54185 9.01891 8.38295C9.2982 8.12805 9.49389 7.79466 9.58031 7.42653C9.66672 7.05841 9.63981 6.67276 9.50311 6.32021C9.36641 5.96766 9.12631 5.66467 8.81433 5.45102C8.50234 5.23737 8.13305 5.12305 7.75492 5.12305C7.37679 5.12305 7.0075 5.23737 6.69552 5.45102C6.38353 5.66467 6.14343 5.96766 6.00673 6.32021C5.87004 6.67276 5.84313 7.05841 5.92954 7.42653C6.01595 7.79466 6.21165 8.12805 6.49094 8.38295C5.97903 8.60298 5.53387 8.95358 5.2 9.39967C5.17045 9.43907 5.14895 9.4839 5.13673 9.53161C5.12451 9.57931 5.1218 9.62896 5.12877 9.67771C5.13573 9.72646 5.15223 9.77336 5.17732 9.81573C5.20241 9.85811 5.2356 9.89513 5.275 9.92467Z" fill="#F9FAFB"/></g><defs><clipPath id="clip0_580_10062"><rect width="12" height="12" fill="white" transform="translate(4 4)"/></clipPath></defs></svg>')}`
    },
    {
      name: 'Simulado',
      courseName: 'Simulado Preparatório',
      professor: 'Equipe de Tutores',
      imageUrl: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M0 4C0 1.79086 1.79086 0 4 0H16C18.2091 0 20 1.79086 20 4V16C20 18.2091 18.2091 20 16 20H4C1.79086 20 0 18.2091 0 16V4Z" fill="#E051B3"/><g clip-path="url(#clip0_580_12035)"><path d="M14.125 5.875H5.875C5.67609 5.875 5.48532 5.95402 5.34467 6.09467C5.20402 6.23532 5.125 6.42609 5.125 6.625V13.375C5.125 13.5739 5.20402 13.7647 5.34467 13.9053C5.48532 14.046 5.67609 14.125 5.875 14.125H6.50266C6.57363 14.125 6.64315 14.1049 6.70314 14.067C6.76313 14.0291 6.81113 13.9749 6.84156 13.9108C7.02392 13.5258 7.31182 13.2005 7.67179 12.9727C8.03176 12.7449 8.449 12.6239 8.875 12.6239C9.301 12.6239 9.71824 12.7449 10.0782 12.9727C10.4382 13.2005 10.7261 13.5258 10.9084 13.9108C10.9389 13.9749 10.9869 14.0291 11.0469 14.067C11.1069 14.1049 11.1764 14.125 11.2473 14.125H14.125C14.3239 14.125 14.5147 14.046 14.6553 13.9053C14.796 13.7647 14.875 13.5739 14.875 13.375V6.625C14.875 6.42609 14.796 6.23532 14.6553 6.09467C14.5147 5.95402 14.3239 5.875 14.125 5.875ZM8.875 11.875C8.57833 11.875 8.28832 11.787 8.04164 11.6222C7.79497 11.4574 7.60271 11.2231 7.48918 10.949C7.37565 10.6749 7.34594 10.3733 7.40382 10.0824C7.4617 9.79139 7.60456 9.52412 7.81434 9.31434C8.02412 9.10456 8.29139 8.9617 8.58236 8.90382C8.87334 8.84594 9.17494 8.87565 9.44903 8.98918C9.72311 9.10271 9.95738 9.29497 10.1222 9.54164C10.287 9.78832 10.375 10.0783 10.375 10.375C10.375 10.7728 10.217 11.1544 9.93566 11.4357C9.65436 11.717 9.27282 11.875 8.875 11.875ZM14.125 13.375H11.4733C11.3098 13.0931 11.1014 12.8398 10.8564 12.625H13C13.0995 12.625 13.1948 12.5855 13.2652 12.5152C13.3355 12.4448 13.375 12.3495 13.375 12.25V7.75C13.375 7.65054 13.3355 7.55516 13.2652 7.48484C13.1948 7.41451 13.0995 7.375 13.0000 7.375H7C6.90054 7.375 6.80516 7.41451 6.73484 7.48484C6.66451 7.55516 6.625 7.65054 6.625 7.75V12.25C6.62496 12.3332 6.65257 12.414 6.70348 12.4798C6.75439 12.5455 6.82572 12.5925 6.90625 12.6133C6.65557 12.8305 6.44281 13.0879 6.27672 13.375H5.875V6.625H14.125V13.375Z" fill="#EBEBEB"/></g><defs><clipPath id="clip0_580_12035"><rect width="12" height="12" fill="white" transform="translate(4 4)"/></clipPath></defs></svg>')}`
    },
];

function InboxPage() {
  const activeProducerUserId = useActiveProducerUserId()
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isStudentInfoVisible, setStudentInfoVisible] = useState(true);
  const [activeFilters, setActiveFilters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const initializedRef = useRef(false)

  const fetchAuth = useCallback(async () => {
    const sess = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session || null
    const token = sess?.access_token || ''
    const pid = String(activeProducerUserId || sess?.user?.id || '').trim()
    return { token, pid, has: Boolean(token && pid) }
  }, [activeProducerUserId])

  const fetchConversationsFromApi = useCallback(async () => {
    const { token, pid, has } = await fetchAuth()
    if (!has) return null
    const r = await fetch(`/api/producer?type=conversations&producerId=${encodeURIComponent(pid)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) return null
    return Array.isArray(body?.data) ? body.data : []
  }, [fetchAuth])

  const fetchConversationFeedFromApi = useCallback(async (conversationId) => {
    const { token, pid, has } = await fetchAuth()
    if (!has) return null
    const r = await fetch(`/api/producer?type=conversation_feed&producerId=${encodeURIComponent(pid)}&conversationId=${encodeURIComponent(conversationId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) return null
    return Array.isArray(body?.data) ? body.data : []
  }, [fetchAuth])

  const fetchInitialConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDetailError(null);
    
    const producerIdParam = getUrlParam('producer_id');
    const { token, pid, has: hasAuthedProducer } = await fetchAuth()
    let convData = []
    if (hasAuthedProducer) {
      try {
        const r = await fetchConversationsFromApi()
        convData = Array.isArray(r) ? r : []
      } catch (_) {
        convData = []
      }
    } else {
      let query = supabase
        .from('conversations')
        .select(`
          id,
          subject,
          tag,
          unread,
          date,
          producer:producers(id, name, external_id),
          student:students (
            id, name, email, avatar_url, whatsapp,
            courses:student_courses(course_name, progress, tag)
          )
        `)
        .order('date', { ascending: false });
      
      if (producerIdParam) {
        query = query.eq('producer.external_id', producerIdParam);
      }
      
      const result = await query;
      convData = Array.isArray(result?.data) ? result.data : []
      if (result?.error) {
        console.error('Error fetching conversations:', result.error);
        convData = [];
      }
    }

    // Se não há dados do Supabase, usar dados mock como fallback
    if ((!convData || convData.length === 0) && !hasAuthedProducer) {
      const mockConversations = [
        {
          id: 1,
          subject: "Dúvida sobre técnica cirúrgica",
          tag: "Curso",
          unread: 2,
          date: "2025-01-14T10:30:00Z",
          producer: { id: 1, name: "Dr. Silva", external_id: "1758243947282x233309006011512600" },
          student: {
            id: 1,
            name: "Ana Beatriz",
            email: "ana.beatriz@email.com",
            avatar_url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiBmaWxsPSIjRjNGNEY2Ii8+CjxjaXJjbGUgY3g9Ijc1IiBjeT0iNjAiIHI9IjIwIiBmaWxsPSIjOUI5Qjk5Ii8+CjxwYXRoIGQ9Ik00NSAxMjBDNDUgMTA1IDU4IDk1IDc1IDk1Uzk1IDEwNSA5NSAxMjBIMTIwQzEyMCAxMDUgMTEwIDkwIDc1IDkwUzMwIDEwNSAzMCAxMjBINDVaIiBmaWxsPSIjOUI5Qjk5Ii8+Cjwvc3ZnPgo=",
            whatsapp: "+55 11 99999-9999",
            courses: [
              { course_name: "Cirurgia Geral", progress: 75, tag: "Curso" },
              { course_name: "Anatomia Avançada", progress: 90, tag: "Curso" }
            ]
          },
          posts: [
            {
              id: 1,
              text: "Olá Dr. Silva! Tenho uma dúvida sobre a técnica de sutura que foi apresentada na última aula. Poderia me explicar melhor quando usar a sutura contínua versus a sutura interrompida? Obrigada!",
              author: { name: "Ana Beatriz" },
              likes: 3,
              liked: false,
              replies: [
                {
                  id: 1,
                  content: "Ótima pergunta, Ana! A sutura contínua é mais rápida e oferece melhor vedação, sendo ideal para fechamento de cavidades. Já a sutura interrompida permite melhor controle da tensão e é preferível em tecidos frágeis.",
                  author: { name: "Dr. Silva" },
                  likes: 5,
                  liked_by_user: false
                }
              ]
            }
          ]
        },
        {
          id: 2,
          subject: "Problema com acesso à Comunidade",
          tag: "Comunidade",
          unread: 1,
          date: "2025-01-13T15:45:00Z",
          producer: { id: 2, name: "Suporte", external_id: "1758243947282x233309006011512600" },
          student: {
            id: 2,
            name: "Carlos Silva",
            email: "carlos.silva@email.com",
            avatar_url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiBmaWxsPSIjRUZGNkZGIi8+CjxjaXJjbGUgY3g9Ijc1IiBjeT0iNjAiIHI9IjIwIiBmaWxsPSIjNjM2NkY3Ii8+CjxwYXRoIGQ9Ik00NSAxMjBDNDUgMTA1IDU4IDk1IDc1IDk1Uzk1IDEwNSA5NSAxMjBIMTIwQzEyMCAxMDUgMTEwIDkwIDc1IDkwUzMwIDEwNSAzMCAxMjBINDVaIiBmaWxsPSIjNjM2NkY3Ii8+Cjwvc3ZnPgo=",
            whatsapp: "+55 11 88888-8888",
            courses: [
              { course_name: "Medicina Interna", progress: 60, tag: "Curso" }
            ]
          },
          posts: [
            {
              id: 2,
              text: "Boa tarde! Estou com dificuldades para acessar a área da comunidade. Quando clico no link, aparece uma mensagem de erro. Podem me ajudar?",
              author: { name: "Carlos Silva" },
              likes: 1,
              liked: false,
              replies: [
                {
                  id: 2,
                  content: "Olá Carlos! Verificamos o problema e já foi corrigido. Tente acessar novamente e nos informe se ainda houver dificuldades.",
                  author: { name: "Suporte" },
                  likes: 2,
                  liked_by_user: false
                }
              ]
            }
          ]
        },
        {
          id: 3,
          subject: "Dúvida sobre Anatomia Cardíaca",
          tag: "Curso",
          unread: 0,
          date: "2025-01-13T09:20:00Z",
          producer: { id: 3, name: "Dr. Pereira", external_id: "prod_003" },
          student: {
            id: 3,
            name: "Ana Pereira",
            email: "ana.pereira@email.com",
            avatar_url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDE1MCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiBmaWxsPSIjRkVGM0Y0Ii8+CjxjaXJjbGUgY3g9Ijc1IiBjeT0iNjAiIHI9IjIwIiBmaWxsPSIjRUM0ODk5Ii8+CjxwYXRoIGQ9Ik00NSAxMjBDNDUgMTA1IDU4IDk1IDc1IDk1Uzk1IDEwNSA5NSAxMjBIMTIwQzEyMCAxMDUgMTEwIDkwIDc1IDkwUzMwIDEwNSAzMCAxMjBINDVaIiBmaWxsPSIjRUM0ODk5Ii8+Cjwvc3ZnPgo=",
            whatsapp: "+55 11 77777-7777",
            courses: [
              { course_name: "Cardiologia", progress: 85, tag: "Curso" },
              { course_name: "Fisiologia", progress: 70, tag: "Curso" }
            ]
          },
          posts: [
            {
              id: 3,
              text: "Professor, gostaria de entender melhor a anatomia das válvulas cardíacas. Especificamente sobre a diferença funcional entre a válvula mitral e a tricúspide.",
              author: { name: "Ana Pereira" },
              likes: 2,
              liked: false,
              replies: []
            }
          ]
        }
      ];
      
      // Filtrar por producer_id se especificado
      const filteredMockConversations = producerIdParam 
        ? mockConversations.filter(conv => conv.producer.external_id === producerIdParam)
        : mockConversations;
      
      convData = filteredMockConversations;
    }

    // Formatar dados das conversas
    const formattedConversations = convData.map(conv => {
      const s = (conv && typeof conv.student === 'object' && conv.student) ? conv.student : {}
      const name = String(s?.name || 'Aluno').trim() || 'Aluno'
      const initials = name.split(' ').map(n => n[0]).join('') || '??'
      return {
        ...conv,
        student: {
          id: s?.id || null,
          name,
          email: String(s?.email || ''),
          avatar_url: s?.avatar_url || null,
          whatsapp: s?.whatsapp || null,
          courses: Array.isArray(s?.courses) ? s.courses : [],
          initials,
        },
      }
    });
    
    setConversations(formattedConversations);
    if (formattedConversations.length > 0 && !initializedRef.current) {
      const first = formattedConversations[0]
      setActiveConversation(first)
      try {
        if (hasAuthedProducer) {
          setCurrentUser({ id: pid, name: first?.producer?.name || 'Professor' })
        }
      } catch (_) {}
      initializedRef.current = true
    } else if (formattedConversations.length === 0) {
      setActiveConversation(null);
    }
    
    setLoading(false);
  }, [fetchAuth, fetchConversationsFromApi]);

  useEffect(() => {
    fetchInitialConversations();
  }, [fetchInitialConversations]);

  const conversationsRef = useRef([])
  useEffect(() => { conversationsRef.current = conversations }, [conversations])
  const conversationsSigRef = useRef('')
  const feedSigRef = useRef('')

  useEffect(() => {
    let cancelled = false
    let timer = null
    const tick = async () => {
      if (cancelled) return
      try {
        if (document?.hidden) return
      } catch (_) {}
      try {
        const convData = await fetchConversationsFromApi()
        if (!Array.isArray(convData)) return
        if (cancelled) return
        if (convData.length === 0 && Array.isArray(conversationsRef.current) && conversationsRef.current.length > 0) return
        const formatted = convData.map(conv => {
          const s = (conv && typeof conv.student === 'object' && conv.student) ? conv.student : {}
          const name = String(s?.name || 'Aluno').trim() || 'Aluno'
          const initials = name.split(' ').map(n => n[0]).join('') || '??'
          return {
            ...conv,
            student: {
              id: s?.id || null,
              name,
              email: String(s?.email || ''),
              avatar_url: s?.avatar_url || null,
              whatsapp: s?.whatsapp || null,
              courses: Array.isArray(s?.courses) ? s.courses : [],
              initials,
            },
          }
        })
        const nextSig = formatted.map((c) => `${String(c?.id || '')}:${String(c?.unread || 0)}:${String(c?.date || '')}`).join('|')
        if (nextSig && nextSig === conversationsSigRef.current) return
        conversationsSigRef.current = nextSig
        setConversations(formatted)
        setActiveConversation((prev) => {
          if (!prev) return prev
          const updated = formatted.find((c) => String(c?.id || '') === String(prev?.id || ''))
          if (!updated) return prev
          return { ...updated, posts: prev.posts }
        })
      } catch (_) {}
    }
    tick()
    timer = setInterval(tick, 12000)
    const onFocus = () => tick()
    try { window.addEventListener('focus', onFocus) } catch (_) {}
    return () => {
      cancelled = true
      try { if (timer) clearInterval(timer) } catch (_) {}
      try { window.removeEventListener('focus', onFocus) } catch (_) {}
    }
  }, [fetchConversationsFromApi])

  useEffect(() => {
    const cid = String(activeConversation?.id || '').trim()
    if (!cid) return
    let cancelled = false
    let timer = null
    let channel = null
    feedSigRef.current = ''
    const tick = async () => {
      if (cancelled) return
      try {
        if (document?.hidden) return
      } catch (_) {}
      try {
        const posts = await fetchConversationFeedFromApi(cid)
        if (!Array.isArray(posts)) return
        if (cancelled) return
        const repliesCount = posts.reduce((acc, p) => acc + (Array.isArray(p?.replies) ? p.replies.length : 0), 0)
        const firstId = posts[0]?.id ? String(posts[0].id) : ''
        const lastId = posts.length > 0 && posts[posts.length - 1]?.id ? String(posts[posts.length - 1].id) : ''
        const nextSig = `${posts.length}:${repliesCount}:${firstId}:${lastId}`
        if (nextSig === feedSigRef.current) return
        feedSigRef.current = nextSig
        setActiveConversation((prev) => {
          if (!prev || String(prev?.id || '').trim() !== cid) return prev
          if (posts.length === 0 && Array.isArray(prev?.posts) && prev.posts.length > 0) return prev
          const detailedPosts = (posts || []).map(post => ({
            ...post,
            id: post.id,
            text: post.content,
            likes: post.likes || 0,
            liked: post.liked || false,
            author: prev.student,
            replies: (post.replies || []).map(reply => ({
              ...reply,
              content: reply.content,
              likes: reply.likes || 0,
              author: reply.author || { name: 'Professor', role: 'Professor' },
              liked_by_user: false
            }))
          }))
          return { ...prev, posts: detailedPosts }
        })
      } catch (_) {}
    }
    tick()
    timer = setInterval(tick, 8000)
    const onFocus = () => tick()
    try { window.addEventListener('focus', onFocus) } catch (_) {}
    try {
      channel = supabase
        .channel(`producer_inbox_${cid}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `conversation_id=eq.${cid}` }, () => tick())
        .subscribe()
    } catch (_) {
      channel = null
    }
    return () => {
      cancelled = true
      try { if (timer) clearInterval(timer) } catch (_) {}
      try { window.removeEventListener('focus', onFocus) } catch (_) {}
      try { if (channel) channel.unsubscribe() } catch (_) {}
      try { if (channel) supabase.removeChannel(channel) } catch (_) {}
    }
  }, [activeConversation?.id, fetchConversationFeedFromApi])

  const fetchConversationDetails = useCallback(async (conversationId, currentUserId) => {
    try {
      const sess = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session || null
      const token = sess?.access_token || ''
      const pid = String(activeProducerUserId || sess?.user?.id || '').trim()
      let posts = []
      if (pid && token) {
        const r = await fetch(`/api/producer?type=conversation_feed&producerId=${encodeURIComponent(pid)}&conversationId=${encodeURIComponent(conversationId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const body = await r.json().catch(() => ({}))
        if (r.ok) posts = Array.isArray(body?.data) ? body.data : []
      } else {
        const { data, error } = await supabase
          .from('v_posts_with_replies')
          .select(`
            post_id,
            conversation_id,
            content,
            created_at,
            likes,
            liked,
            replies_json
          `)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(200)
        if (error) throw error
        posts = (Array.isArray(data) ? data : []).map((row) => ({
          id: row.post_id,
          conversation_id: row.conversation_id,
          content: row.content,
          created_at: row.created_at,
          likes: row.likes,
          liked: row.liked,
          replies: (row.replies_json || []).map((reply) => ({ ...reply, liked_by: reply.liked_by || [] })),
        }))
      }
      const activeConv = conversations.find(c => c.id === conversationId);
      if (!activeConv) return null;

      const detailedPosts = posts.map(post => ({
        ...post,
        id: post.id,
        text: post.content,
        likes: post.likes || 0,
        liked: post.liked || false,
        author: post.author || activeConv.student,
        replies: (post.replies || []).map(reply => ({
          ...reply,
          content: reply.content,
          likes: reply.likes || 0,
          author: reply.author || { name: 'Professor', role: 'Professor' },
          liked_by_user: (reply.liked_by || []).includes(currentUserId)
        }))
      }));

      return { ...activeConv, posts: detailedPosts };
    } catch (err) {
      console.error('fetchConversationDetails error', err);
      // setDetailError("Sem permissão ou conversa não encontrada");
      return null;
    }
  }, [conversations, activeProducerUserId]);

  const handleSelectConversation = useCallback(async (id, conversationsList = null) => {
    setDetailError(null);
    
    // Use a lista fornecida ou a lista atual de conversas
    const currentConversations = conversationsList || conversations;
    const existingConv = currentConversations.find(c => c.id === id);
    if (!existingConv) return;

    try {
      const sess = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session || null
      const pid = String(activeProducerUserId || sess?.user?.id || '').trim()
      if (pid) {
        setCurrentUser({
          id: pid,
          name: existingConv.producer?.name || 'Professor'
        });
      }
    } catch (_) {}
    
    // Se a conversa já tem posts (dados mock), definir imediatamente
    if (existingConv.posts && existingConv.posts.length > 0) {
      setActiveConversation(existingConv);
      
      if (existingConv.producer) {
        setCurrentUser({
          id: existingConv.producer.id,
          name: existingConv.producer.name || 'Professor'
        });
      }
      
      if (existingConv.unread > 0) {
        setConversations(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c));
      }
      return;
    }

    // Para conversas do Supabase, buscar detalhes primeiro
    let currentUserId = null;
    if (existingConv.producer) {
      currentUserId = existingConv.producer.id;
      setCurrentUser({
        id: currentUserId,
        name: existingConv.producer.name || 'Professor'
      });
    }

    const detailedConversation = await fetchConversationDetails(id, currentUserId);
    if (detailedConversation) {
      setActiveConversation(detailedConversation);
      setConversations(prev => prev.map(c => c.id === id ? { ...detailedConversation, unread: 0 } : c));
    } else {
      // Se não conseguir buscar detalhes, definir a conversa sem posts
      setActiveConversation(existingConv);
    }

    if (existingConv.unread > 0) {
      try {
        const sess = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session || null
        const token = sess?.access_token || ''
        const pid = String(activeProducerUserId || sess?.user?.id || '').trim()
        if (pid && token) {
          await fetch(`/api/producer?type=conversation_mark_read&producerId=${encodeURIComponent(pid)}&conversationId=${encodeURIComponent(id)}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        } else {
          const { error: updateError } = await supabase
            .from('conversations')
            .update({ unread: 0 })
            .eq('id', id);
          if (updateError) console.error('Error updating unread count:', updateError);
        }
      } catch (_) {}
    }
  }, [conversations, fetchConversationDetails, activeProducerUserId]);
  
  const unreadConversations = conversations.filter(c => c.unread > 0);

  const handleAvatarClick = (id) => {
    handleSelectConversation(id);
    setStudentInfoVisible(true);
  };

  const handleAddReply = async (postId, newReplyText) => {
    if (!activeConversation || !activeConversation.posts || !currentUser || !postId) {
      console.error("Não foi possível enviar a resposta. Faltam dados.");
      return;
    }
    try {
      const sess = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session || null
      const token = sess?.access_token || ''
      const pid = String(activeProducerUserId || sess?.user?.id || '').trim()
      if (!pid || !token) throw new Error('missing_token')

      const r = await fetch(`/api/producer?type=reply_create&producerId=${encodeURIComponent(pid)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          conversationId: String(activeConversation?.id || ''),
          postId: String(postId || ''),
          text: String(newReplyText || ''),
          producerName: String(currentUser?.name || 'Professor'),
        }),
      })
      const body = await r.json().catch(() => ({}))
      const errText = body?.message ? `${String(body?.error || 'reply_failed')}: ${String(body.message)}` : String(body?.error || body?.message || 'reply_failed')
      if (!r.ok || !body?.reply?.id) throw new Error(errText)

      const reply = body.reply
      const newReply = {
        id: reply.id,
        content: reply.content,
        created_at: reply.created_at,
        likes: reply.likes || 0,
        author: reply.author || { id: pid, name: currentUser.name || 'Professor' },
        liked_by: Array.isArray(reply.liked_by) ? reply.liked_by : [],
        liked_by_user: false
      };

      setActiveConversation(prev => {
        if (!prev || !prev.posts) return null;
        const updatedPosts = prev.posts.map((p) => {
          if (p.id === postId) {
            const newReplies = [...(p.replies || []), newReply];
            return { ...p, replies: newReplies };
          }
          return p;
        });
        return { ...prev, posts: updatedPosts };
      });
    } catch (e) {
      console.error('Error adding reply:', e);
      setDetailError(String(e?.message || 'Não foi possível enviar a resposta.'))
    }
  };
  
  const handleLikePost = async (postId) => {
    if (!activeConversation || !activeConversation.posts) return;

    const post = activeConversation.posts.find(p => p.id === postId);
    if (!post) return;

    const newLikedState = !post.liked;
    const newLikesCount = newLikedState ? post.likes + 1 : post.likes - 1;

    setActiveConversation(prev => {
      if (!prev) return null;
      const updatedPosts = (prev.posts || []).map(p => 
        p.id === postId ? { ...p, liked: newLikedState, likes: newLikesCount } : p
      );
      return { ...prev, posts: updatedPosts };
    });

    const { error } = await supabase
      .from('posts')
      .update({ likes: newLikesCount, liked: newLikedState })
      .eq('id', postId);

    if (error) {
      console.error('Error updating post like:', error);
      setActiveConversation(prev => {
        if (!prev) return null;
        const updatedPosts = (prev.posts || []).map(p => 
          p.id === postId ? { ...p, liked: post.liked, likes: post.likes } : p
        );
        return { ...prev, posts: updatedPosts };
      });
    }
  };

  const handleLikeReply = async (replyId) => {
    if (!activeConversation || !activeConversation.posts || !currentUser) return;

    let targetReply = null;
    let postIndex = -1;

    activeConversation.posts.forEach((p, pIdx) => {
      const reply = (p.replies || []).find(r => r.id === replyId);
      if (reply) {
        targetReply = reply;
        postIndex = pIdx;
      }
    });

    if (!targetReply) return;

    const currentlyLiked = targetReply.liked_by_user;
    const newLikesCount = currentlyLiked ? (targetReply.likes || 1) - 1 : (targetReply.likes || 0) + 1;

    setActiveConversation(prev => {
      if (!prev) return null;
      const updatedPosts = [...prev.posts];
      const postToUpdate = { ...updatedPosts[postIndex] };
      postToUpdate.replies = (postToUpdate.replies || []).map(r =>
        r.id === replyId ? { ...r, likes: newLikesCount, liked_by_user: !currentlyLiked } : r
      );
      updatedPosts[postIndex] = postToUpdate;
      return { ...prev, posts: updatedPosts };
    });

    const { error } = await supabase.rpc('toggle_like_reply', {
        reply_id: replyId,
        user_id: currentUser.id
    });
    
    if (error) {
      console.error('Error toggling reply like:', error);
      setActiveConversation(prev => {
        if (!prev) return null;
        const updatedPosts = [...prev.posts];
        const postToUpdate = { ...updatedPosts[postIndex] };
        postToUpdate.replies = (postToUpdate.replies || []).map(r =>
          r.id === replyId ? { ...r, likes: targetReply.likes, liked_by_user: targetReply.liked_by_user } : r
        );
        updatedPosts[postIndex] = postToUpdate;
        return { ...prev, posts: updatedPosts };
      });
    }
  };


  const handleEditReply = async (replyId, newText) => {
    const { error } = await supabase
      .from('replies')
      .update({ text: newText })
      .eq('id', replyId);
  
    if (error) {
      console.error('Error editing reply:', error);
      return;
    }
  
    setActiveConversation(prev => {
      if (!prev || !prev.posts) return null;
      const updatedPosts = prev.posts.map(p => ({
        ...p,
        replies: (p.replies || []).map(r =>
          r.id === replyId ? { ...r, content: newText } : r
        )
      }));
      return { ...prev, posts: updatedPosts };
    });
  };

  const handleDeleteReply = async (replyId) => {
    if (!activeConversation) return;

    const { error } = await supabase
      .from('replies')
      .delete()
      .eq('id', replyId);
  
    if (error) {
      console.error('Error deleting reply:', error);
      return;
    }
  
    const updatedConv = { ...activeConversation };
    if (updatedConv.posts && updatedConv.posts.length > 0) {
        updatedConv.posts[0].replies = (updatedConv.posts[0].replies || []).filter(r => r.id !== replyId);
    }
    updatedConv.unread = 0;

    setActiveConversation(updatedConv);

    setConversations(prevConvs =>
      prevConvs.map(c =>
        c.id === activeConversation.id ? updatedConv : c
      )
    );
  };

  const filteredConversations = conversations
    .filter(c => String(c?.student?.name || '').toLowerCase().includes(String(searchTerm || '').toLowerCase()))
    .filter(c => 
      activeFilters.length === 0 ? true : activeFilters.includes(c.tag)
    );
  
  const activeFilterData = activeFilters.length > 0
    ? filterOptions.find(f => f.name === activeFilters[0])
    : null;

  const retryFetchDetails = () => {
    if (activeConversation) {
      handleSelectConversation(activeConversation.id);
    }
  };

  const hasConversations = conversations.length > 0;
  
  const mainGridCols = hasConversations 
  ? (isStudentInfoVisible ? 'grid-cols-[320px_1fr_340px]' : 'grid-cols-[320px_1fr_70px]')
  : 'grid-cols-1';

  return (
    <>
      <Helmet>
        <title>Inbox – Connekt</title>
        <meta name="description" content="Sistema de inbox para gerenciar conversas com alunos do curso" />
      </Helmet>
      <main className={`grid max-w-full mx-auto ${mainGridCols}`} style={{ height: '900px' }}>
        {hasConversations && !loading && !error && (
          <Sidebar
            conversations={filteredConversations}
            activeId={activeConversation?.id}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onSelectConversation={handleSelectConversation}
            activeFilters={activeFilters}
            setActiveFilters={setActiveFilters}
            filterOptions={filterOptions}
          />
        )}
        <div className="flex flex-col col-span-full lg:col-span-1 h-full bg-[#f6f5fa]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-xl font-semibold">Carregando conversas...</div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <h2 className="text-xl font-bold text-red-500 mb-4">Ocorreu um erro!</h2>
              <p className="text-lg text-gray-700 mb-4">{error}</p>
              <Button onClick={fetchInitialConversations}>Tentar novamente</Button>
            </div>
          ) : hasConversations ? (
            <>
              <ChatArea
                conversation={activeConversation}
                onAddReply={handleAddReply}
                onLikePost={handleLikePost}
                onLikeReply={handleLikeReply}
                onEditReply={handleEditReply}
                onDeleteReply={handleDeleteReply}
                onToggleStudentInfo={() => setStudentInfoVisible(!isStudentInfoVisible)}
                activeFilterData={activeFilterData}
                currentUser={currentUser}
                error={detailError}
                onRetry={retryFetchDetails}
              />
              <div className="w-full h-[72px] bg-white border-b-[1px] border-[#E3E4E5] flex items-center justify-end pr-4">
                <span className="text-gray-500 font-medium">
                  <span className="text-xs">Total:</span>{' '}
                  <span className="text-sm font-medium text-[#000000]">{filteredConversations.length} perguntas</span>
                </span>
              </div>
            </>
          ) : (
            <EmptyInbox />
          )}
        </div>
        
        {hasConversations && !loading && !error && (
          isStudentInfoVisible ? (
            <StudentInfoSidebar 
              student={activeConversation?.student}
              isVisible={isStudentInfoVisible}
              onClose={() => setStudentInfoVisible(false)}
              filterOptions={filterOptions}
            />
          ) : (
            <UnreadAvatarsBar 
              conversations={filteredConversations}
              onAvatarClick={handleAvatarClick}
              onToggleStudentInfo={() => setStudentInfoVisible(!isStudentInfoVisible)}
            />
          )
        )}
      </main>
    </>
  );
}

export default InboxPage;
