// Script para integração com Bubble.io
// Adicione este código na página do Bubble que contém o iframe

let bubbleModalOverlay = null;
let bubbleModalContainer = null;

// Escutar mensagens do iframe
window.addEventListener('message', function(event) {
  // Verificar se a mensagem vem do iframe correto (opcional - adicione verificação de origem)
  // if (event.origin !== 'https://seu-app.vercel.app') return;
  
  const { type, modalContent } = event.data;
  
  if (type === 'MODAL_OPENED') {
    createBubbleModal();
  } else if (type === 'MODAL_CLOSED') {
    closeBubbleModal();
  }
});

function createBubbleModal() {
  // Criar overlay de fundo
  bubbleModalOverlay = document.createElement('div');
  bubbleModalOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(3px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.3s ease;
  `;

  // Criar container do modal
  bubbleModalContainer = document.createElement('div');
  bubbleModalContainer.style.cssText = `
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    max-width: 90vw;
    max-height: 90vh;
    width: 800px;
    height: 600px;
    position: relative;
    animation: modalSlideIn 0.3s ease;
    overflow: hidden;
  `;

  // Criar iframe dentro do modal
  const modalIframe = document.createElement('iframe');
  modalIframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 12px;
  `;
  modalIframe.src = window.location.origin + '/banco-de-questoes?modal=true';

  // Botão de fechar
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '×';
  closeButton.style.cssText = `
    position: absolute;
    top: 15px;
    right: 20px;
    background: none;
    border: none;
    font-size: 24px;
    color: #666;
    cursor: pointer;
    z-index: 10001;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s ease;
  `;
  
  closeButton.onmouseover = function() {
    this.style.backgroundColor = '#f3f4f6';
    this.style.color = '#374151';
  };
  
  closeButton.onmouseout = function() {
    this.style.backgroundColor = 'transparent';
    this.style.color = '#666';
  };

  closeButton.onclick = closeBubbleModal;

  // Montar o modal
  bubbleModalContainer.appendChild(modalIframe);
  bubbleModalContainer.appendChild(closeButton);
  bubbleModalOverlay.appendChild(bubbleModalContainer);
  document.body.appendChild(bubbleModalOverlay);

  // Prevenir scroll do body
  document.body.style.overflow = 'hidden';

  // Fechar modal ao clicar no overlay
  bubbleModalOverlay.onclick = function(e) {
    if (e.target === bubbleModalOverlay) {
      closeBubbleModal();
    }
  };
}

function closeBubbleModal() {
  if (bubbleModalOverlay) {
    // Animação de saída
    bubbleModalOverlay.style.animation = 'fadeOut 0.3s ease';
    bubbleModalContainer.style.animation = 'modalSlideOut 0.3s ease';
    
    setTimeout(() => {
      if (bubbleModalOverlay && bubbleModalOverlay.parentNode) {
        bubbleModalOverlay.parentNode.removeChild(bubbleModalOverlay);
      }
      bubbleModalOverlay = null;
      bubbleModalContainer = null;
      
      // Restaurar scroll do body
      document.body.style.overflow = '';
    }, 300);
  }
}

// Adicionar CSS das animações
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  
  @keyframes modalSlideIn {
    from { 
      opacity: 0;
      transform: scale(0.95) translateY(-20px);
    }
    to { 
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  
  @keyframes modalSlideOut {
    from { 
      opacity: 1;
      transform: scale(1) translateY(0);
    }
    to { 
      opacity: 0;
      transform: scale(0.95) translateY(-20px);
    }
  }
`;
document.head.appendChild(style);

// Função para abrir modal manualmente (caso necessário)
function openBubbleModal() {
  createBubbleModal();
}

// Função para fechar modal manualmente (caso necessário)
function closeBubbleModalManually() {
  closeBubbleModal();
}