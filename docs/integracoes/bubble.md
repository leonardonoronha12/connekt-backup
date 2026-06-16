# Integração com Bubble

Este projeto pode ser embutido em Bubble via iframe. O fluxo abaixo é um exemplo de “modal host” no Bubble, usando `postMessage` para abrir/fechar um modal que renderiza o app.

## Exemplo (Bubble)

1) Crie uma página no Bubble com um iframe apontando para o app.
2) Adicione um script que escuta `window.postMessage` e controla o modal.
3) Dentro do app, dispare eventos `postMessage` quando abrir/fechar modais.

O snippet completo foi removido da raiz do repositório para evitar duplicação e manter o código-fonte do app desacoplado de integrações externas.

