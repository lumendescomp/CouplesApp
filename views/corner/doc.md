# Nosso Cantinho — Documentação linha a linha

Este documento explica a estrutura e o funcionamento da página `views/corner/index.ejs`, agora sem dependências do htmx dentro da página. O backend continua servindo parciais HTML para criar/alterar itens, mas o front consome via `fetch`.

## Visão geral

- Layout: grid com duas colunas — canvas (PixiJS) e inventário.
- Canvas: container `#corner-canvas` com altura fixa (420px), toolbar de zoom e overlay de ações do item selecionado.
- Inventário: busca, grupos colapsáveis persistidos em `localStorage`, drag & drop para criar itens, duplo clique para criar no centro.
- Render: PixiJS v7 com um container `world` que suporta pan/zoom. Projeção isométrica simples (`HS_ISO`).
- Interações: seleção, arraste com snap 0.25 de grid, rotação, tilt (skew), flip, escala, altura (z), ordenação por layer/y.
- Persistência: endpoints REST (`/corner/items` e variantes) retornam um parcial com o item atualizado; o front converte esse HTML em dados locais.

## Estrutura do arquivo

1. Cabeçalho e grid principal: título e duas colunas (canvas + inventário).
2. Toolbar de zoom (botões +/- e reset com label sincronizado).
3. Overlay de ações do item (layer up/down/top/bottom, escala +/- e input, deletar).
4. Tag `<script type="application/json" id="corner-items-data">` injeta a lista inicial de itens como JSON (evita EJS direto no JS).
5. Estilos do scrollbar do inventário (Firefox e WebKit) para estética consistente.
6. Inclusões das libs PixiJS e `@pixi/unsafe-eval` (necessária para ambientes com CSP mais restrito).
7. Script principal: isolado em IIFE `CornerPage()` para suportar re-montagem sem vazamentos.

## Script principal (seções)

- Boot dos dados (`window.__cornerItems`) lendo a tag JSON inicial.
- HS_ISO: define a grade isométrica (gridN=20, tileW=72, tileH=36), calcula origem para encostar a primeira fileira no topo e projeta `gx,gy -> sx,sy`.
- Estado da cena (`SCENE`): mapa de itens, id selecionado, container `world`, zoom, estado de pan/space, floor (grade), ghost (preview de DnD), atlas (opcional).
- Utilitários `pctToGrid`/`gridToPct` para converter porcentagens persistidas em índices de grade (com resolução 0.25) e vice‑versa.
- `domItemToData`: extrai os atributos de um elemento parcial HTML do item para objeto JS.
- `loadAtlasIfAny`: tenta carregar atlas ou mapa de imagens, inclusive data URIs; suporta TexturePacker.
- `ensurePixi`: cria `PIXI.Application`, adiciona `world`, calcula origem, desenha o piso, carrega atlas, cria sprites para `__cornerItems`, liga teclado e toolbar de zoom, e sincroniza o label.
- `setZoom`/`updateZoomLabel`: aplica zoom ancorado ao centro (ou cursor na roda) e atualiza o label.
- `drawFloor`: desenha a malha de losangos conforme a grade.
- `textureFromUrl` e `spriteFor`: cria o sprite a partir do atlas, URL de imagem ou SVG inline; define âncora, escala base, sombra e propriedades.
- Ghost (preview DnD): `ensureGhost`/`hideGhost`/`updateGhostPosition` mantém um container translúcido com snap 0.25; clampa nas bordas da grade.
- Itens: `addOrUpdateItem` projeta, aplica z/rotação/escala/tilt/flip, registra handlers de clique/drag, e chama `sortByDepth` (ordena por layer e y).
- Drag existente: `startDrag`/`dragMove`/`finishDrag` atualizam a posição com snap 0.25 e salvam via `savePosition`.
- Seleção e overlay: `selectItem`, `updateOverlayPosition` (clampa overlay dentro do canvas), `bindOverlayActions` (layer, escala, deletar), `clearSelection`.
- Pan: `bindPan` usa botão do meio ou Space+arraste com esquerdo, atualiza `world.position` e reposiciona overlay.
- Wheel: `bindWheelRotate` implementa zoom sem modificadores; Shift para escala; Ctrl/Alt para rotação do item.
- Salvamentos: `savePosition`, `saveNudge`, `saveHeight`, `saveScale`, `saveTilt`, `saveFlip`, `saveLayer`, `saveStack`, `deleteItem` — todos usam `fetch` com CSRF header; quando o endpoint retorna HTML com o item, convertem com `htmlToNode` e atualizam a cena e `__cornerItems`.
- Inventário: `loadInventoryFromManifest` busca `/public/assets/atlas/manifest.json`, `renderInventoryGroups` constrói UI por categoria, `bindInventoryInteractions` liga colapsar/expandir com persistência e interações dos itens (click destaca/abre grupo; dragstart/dragend; dblclick cria ao centro). `refreshGroupCounts` soma itens no canvas por chave e exibe ao lado do título do grupo.
- Drop no canvas: listeners em `#corner-canvas` para `dragover/dragenter/dragleave/drop`; mostram ghost, calculam melhor célula (snap 0.25, bordas permitidas), criam item via POST e atualizam contadores.
- Resize: recalcula origem, redesenha piso e re-renderiza itens; reposiciona overlay.
- Destroy: remove listeners e destrói o app Pixi sem vazamentos.

## Atalhos de teclado

- Q/E: rotaciona ±15°.
- T/G: tilt X (skew Y) −/+ 2°.
- Y/H: tilt Y (skew X) −/+ 2°.
- F/V: flip horizontal/vertical.
- Ctrl/Cmd +/−: ajusta escala do item selecionado (0.25–2.0).
- PageUp/PageDown ou +/−: ajusta altura (z) em ±1 unidade.
- [/]: ajusta ordem de empilhamento (stack) relativa.
- Delete: remove o item.
- Space + arraste (botão esquerdo) ou botão do meio: pan do canvas.

## Decisões e detalhes

- Bordas: o snap e os clamps foram ajustados para permitir posicionar itens exatamente nas bordas da grade (0 até gridN−1).
- Origem: `originY = tileH/2` encosta a primeira fileira no topo, mantendo o losango visível; toolbar usa `pointer-events-none` ao redor e `pointer-events-auto` nos botões para não bloquear cliques no topo.
- Zoom: sempre sincroniza o label na toolbar; na roda, ancora no cursor para UX previsível.
- Contadores: atualizados após criar/deletar via atualização do array `__cornerItems` e chamada a `refreshGroupCounts()`.
- htmx: removido da página (outbox, listeners e referências ao `#add-item-form`). O layout base ainda carrega htmx para navegação global, mas esta página não depende dele.

## Possíveis melhorias futuras

- Testes unitários dos utilitários (conversões de grid/porcentagem, projeção isométrica).
- Persistir e restaurar zoom/pan por usuário.
- Snapping baseado em bounding boxes específicas por item (além de `sizes`).
- Undo/redo no cliente.
