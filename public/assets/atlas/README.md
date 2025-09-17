# Atlas de Itens (opcional)

Coloque aqui um atlas gerado (spritesheet) no formato suportado pelo Pixi v7.

Arquivos esperados:

- `items.png` — imagem do atlas
- `items.json` — metadados (frames) com chaves dos itens

Como nomear frames:

- Use o `item_key` como nome do frame: `table`, `chair`, `plant`, `lamp`, `sofa`, `tv`.
- Alternativamente, use sufixos de extensão: `table.png`, `sofa.png` etc. (o código tenta ambos).

Observações:

- O código tenta carregar `/assets/atlas/items.json`. Se não existir, usa os SVGs inline como fallback.
- Recomenda-se anchor dos sprites centrado visualmente (o código usa `anchor.set(0.5)`). Ajuste o recorte no atlas para que o “pé” do item fique próximo ao centro.
- Se houver variantes por rotação, padronize frames como `sofa_0`, `sofa_90` etc. (o código atual usa um único frame e rotaciona no runtime; suporte a variantes pode ser adicionado depois).
