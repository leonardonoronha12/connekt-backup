# Changelog

Todas as mudanças relevantes nesta versão do AppCódigo.

## 2025-11-14

### UI e Estilo
- Botão selecionado: largura `220px`, altura `36px`, raio `4px`, opacidade `100%`, gap `12px`, paddings `8px` (topo/baixo) e `16px` (esquerda/direita), cor de fundo `#F9FAFB`. Borda e estado de hover preservados.
- Bolinhas de status: `span` igualado ao tamanho das imagens (`16.25px x 16.25px`), imagens (`certa.png`/`errada.png`) preenchem o `span` usando `w-full h-full` sem posicionamento absoluto.
- Tipografia do texto "Questão N": fonte Inter, peso `500`, tamanho `14px`, `line-height` `16px`, `letter-spacing` `0px`, cor `#22252B`.

### Estrutura e Comportamento
- Speed Insights (Vercel) desativado em ambiente local (localhost) para evitar erro "Service is unavailable". O componente só renderiza em produção e fora do localhost.

### Build e Preview
- Build de produção gerada com `npm run build`.
- Preview disponível em `http://localhost:3000/`.
- Página de verificação: `http://localhost:3000/reposta-correta-simulado`.

### Observações
- Sem mudanças de banco ou schema nesta versão.
- Alguns arquivos e imagens podem estar não rastreados localmente; revise antes do push, se necessário.

---

Para versões anteriores, consulte os commits nas branches correspondentes.