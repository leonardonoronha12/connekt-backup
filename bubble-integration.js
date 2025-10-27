// Script para integração com Bubble.io
// Adicione este código na página do Bubble que contém o iframe

// Escutar mensagens do iframe
window.addEventListener('message', function(event) {
  // Verificar se a mensagem vem do iframe correto (opcional - adicione verificação de origem)
  // if (event.origin !== 'http://localhost:3000') return;
  
  const { type } = event.data;
  
  if (type === 'MODAL_OPENED') {
    // Aplicar blur na página do Bubble
    document.body.style.filter = 'blur(3px)';
    document.body.style.pointerEvents = 'none';
    
    // Alternativa: aplicar blur apenas em elementos específicos
    // const mainContent = document.querySelector('.main-content'); // ajuste o seletor conforme necessário
    // if (mainContent) {
    //   mainContent.style.filter = 'blur(3px)';
    //   mainContent.style.pointerEvents = 'none';
    // }
  } else if (type === 'MODAL_CLOSED') {
    // Remover blur da página do Bubble
    document.body.style.filter = '';
    document.body.style.pointerEvents = '';
    
    // Alternativa: remover blur de elementos específicos
    // const mainContent = document.querySelector('.main-content'); // ajuste o seletor conforme necessário
    // if (mainContent) {
    //   mainContent.style.filter = '';
    //   mainContent.style.pointerEvents = '';
    // }
  }
});

// Função para aplicar blur manualmente (caso necessário)
function applyBlurToBubblePage() {
  document.body.style.filter = 'blur(3px)';
  document.body.style.pointerEvents = 'none';
}

// Função para remover blur manualmente (caso necessário)
function removeBlurFromBubblePage() {
  document.body.style.filter = '';
  document.body.style.pointerEvents = '';
}