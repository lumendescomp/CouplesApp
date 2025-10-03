# 📸 Nosso Álbum - Documentação da Feature

## 🎯 Visão Geral

A feature "Nosso Álbum" permite que casais criem composições visuais únicas arrastando fotos para slots predefinidos em templates temáticos. A primeira versão (MVP) inclui um template em formato de coração com 6 slots posicionados estrategicamente.

---

## ✨ Funcionalidades Implementadas

### 1. **Upload de Fotos**

- ✅ Upload via botão "Adicionar Foto"
- ✅ Formatos aceitos: PNG, JPG, JPEG, GIF, WebP
- ✅ Tamanho máximo: 5MB por foto
- ✅ Limite: 20 fotos por casal
- ✅ Armazenamento: `/public/album-photos/couple{id}_{timestamp}.ext`
- ✅ Feedback instantâneo via HTMX

### 2. **Template "Coração de Memórias"**

- ✅ 6 slots distribuídos em formato de coração
- ✅ Posicionamento responsivo
- ✅ Fundo decorativo em SVG (coração opaco)
- ✅ Aspect ratio fixo 1:1

**Distribuição dos Slots:**

```
     [1]       [2]      ← Topo (120x120px)

  [3]           [4]     ← Centro (140x140px)

    [5]       [6]       ← Base (110x110px)
```

### 3. **Drag & Drop**

- ✅ Arrastar fotos da biblioteca → slots
- ✅ Feedback visual (escala e sombra no hover)
- ✅ Indicador de "drag over" nos slots
- ✅ Cursor grab/grabbing
- ✅ Substituição de fotos em slots ocupados

### 4. **Gerenciamento de Fotos**

- ✅ Visualização em grid (3-6 colunas responsivas)
- ✅ Deletar foto da biblioteca
- ✅ Remover foto de slot específico
- ✅ Confirmação antes de deletar
- ✅ Atualização automática de slots ao deletar foto

### 5. **UI/UX**

- ✅ Toast de feedback para ações
- ✅ Estados vazios informativos
- ✅ Contador de fotos (X/20)
- ✅ Indicadores visuais claros
- ✅ Animações suaves

---

## 🗄️ Estrutura do Banco de Dados

### **Tabela: album_photos**

```sql
CREATE TABLE album_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  couple_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id)
);
CREATE INDEX idx_album_photos_couple ON album_photos(couple_id);
```

### **Tabela: album_slots**

```sql
CREATE TABLE album_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  couple_id INTEGER NOT NULL,
  template_id INTEGER NOT NULL DEFAULT 1,
  slot_number INTEGER NOT NULL,
  photo_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id),
  FOREIGN KEY (photo_id) REFERENCES album_photos(id),
  UNIQUE(couple_id, template_id, slot_number)
);
CREATE INDEX idx_album_slots_couple ON album_slots(couple_id);
```

**Nota:** `template_id = 1` representa o template "Coração de Memórias"

---

## 🛣️ Rotas da API

### **GET /album**

Exibe a página do álbum com fotos e slots preenchidos.

**Response:**

- Renderiza `views/album/index.ejs`
- Dados: `photos` (array), `slots` (mapa 1-6)

---

### **POST /album/upload**

Faz upload de uma nova foto para a biblioteca.

**Request:**

- `Content-Type: multipart/form-data`
- Field: `photo` (arquivo)
- CSRF token

**Response:**

- Success: Fragment HTML da foto (`_photo_item.ejs`)
- Error 400: "Limite de 20 fotos atingido"

**Validações:**

- ✅ Formato de arquivo
- ✅ Tamanho (5MB)
- ✅ Limite de 20 fotos por casal

---

### **POST /album/slot/:slotNumber**

Atribui uma foto a um slot específico.

**Request:**

```json
{
  "photo_id": 123
}
```

**Response:**

- Success: Fragment HTML do slot preenchido (`_slot_filled.ejs`)
- Error 400: "Slot inválido" / "Foto não encontrada"

**Validações:**

- ✅ Slot number entre 1 e 6
- ✅ Foto pertence ao casal
- ✅ Upsert automático (INSERT ou UPDATE)

---

### **DELETE /album/slot/:slotNumber**

Remove a foto de um slot específico.

**Response:**

- Success: Fragment HTML do slot vazio (`_slot_empty.ejs`)

---

### **DELETE /album/photo/:photoId**

Deleta uma foto da biblioteca e remove de todos os slots.

**Response:**

- Success: Status 200 + Trigger `photoDeleted`
- Error 404: "Foto não encontrada"

**Ações:**

1. Remove foto de `album_slots` (cascade)
2. Remove foto de `album_photos`
3. Deleta arquivo físico do disco

---

## 🎨 Componentes de View

### **views/album/index.ejs**

Página principal com template e biblioteca.

**Estrutura:**

```html
<section>
  <!-- Template do álbum -->
  <div class="album-template">
    <div class="album-slot" data-slot="1">...</div>
    <!-- ... 6 slots ... -->
  </div>
</section>

<section>
  <!-- Biblioteca de fotos -->
  <div id="photos-grid">
    <!-- Grid de fotos -->
  </div>
</section>
```

---

### **views/album/\_photo_item.ejs**

Item individual na biblioteca (arrastável).

**Props:**

- `photo.id`
- `photo.file_path`

**Features:**

- Draggable
- Botão de deletar (hover)

---

### **views/album/\_slot_empty.ejs**

Slot vazio (estado inicial).

**Visual:**

- Border tracejado
- Ícone de imagem
- Texto "Arraste"

---

### **views/album/\_slot_filled.ejs**

Slot preenchido com foto.

**Props:**

- `filePath`
- `slotNumber`

**Features:**

- Imagem cover
- Botão de remover (hover)

---

## 🔧 JavaScript Client-Side

### **Drag & Drop Implementation**

```javascript
// Tornar fotos arrastáveis
item.draggable = true;
item.addEventListener("dragstart", (e) => {
  e.dataTransfer.setData("photo-id", item.dataset.photoId);
});

// Receptores (slots)
slot.addEventListener("drop", async (e) => {
  const photoId = e.dataTransfer.getData("photo-id");
  // POST /album/slot/:slotNumber
});
```

### **Funções Principais**

| Função              | Propósito                          |
| ------------------- | ---------------------------------- |
| `initDragDrop()`    | Inicializa eventos de drag & drop  |
| `initSlotRemoval()` | Vincula botões de remoção de slots |
| `initPhotoDelete()` | Vincula botões de deletar foto     |

**Re-inicialização:** Após eventos `htmx:afterSwap`

---

## 🚀 Próximos Passos (Roadmap)

### **Fase 2: Múltiplos Templates**

- [ ] Template "Grid 3x3"
- [ ] Template "Polaroid Scattered"
- [ ] Template "Linha do Tempo"
- [ ] Seletor de templates na UI

### **Fase 3: Edição de Fotos**

- [ ] Crop/Zoom na foto antes de inserir no slot
- [ ] Filtros (preto & branco, sépia, etc.)
- [ ] Rotação de fotos

### **Fase 4: Compartilhamento**

- [ ] Exportar álbum como imagem PNG/JPG
- [ ] Compartilhar via link público (opcional)
- [ ] Download do álbum completo

### **Fase 5: Animações**

- [ ] Transições ao adicionar/remover fotos
- [ ] Preview em fullscreen ao clicar
- [ ] Slideshow das fotos do álbum

---

## 🐛 Limitações Conhecidas

1. **Responsividade Mobile:** Template pode precisar de ajustes para telas pequenas
2. **Sem Crop:** Fotos são exibidas com `object-cover`, pode cortar partes importantes
3. **Um Template Apenas:** Por enquanto, apenas "Coração de Memórias" disponível
4. **Sem Colaboração Real-Time:** Mudanças não aparecem instantaneamente para o parceiro

---

## 🔒 Segurança

✅ **CSRF Protection:** Todos os endpoints POST/DELETE protegidos  
✅ **Validação de Ownership:** Fotos só podem ser acessadas pelo casal proprietário  
✅ **File Type Validation:** Apenas imagens permitidas  
✅ **File Size Limit:** 5MB máximo  
✅ **Quota Enforcement:** 20 fotos por casal  
✅ **Path Sanitization:** Upload em diretório isolado

---

## 📊 Métricas Sugeridas

Para análise futura:

- Número médio de fotos por casal
- Taxa de preenchimento de slots (%)
- Template mais popular
- Tempo médio para completar primeiro álbum

---

## 🎓 Como Usar (Guia do Usuário)

1. **Adicionar Fotos:**

   - Clique em "Adicionar Foto"
   - Selecione uma imagem (max 5MB)
   - Foto aparece na biblioteca

2. **Preencher Slots:**

   - Arraste uma foto da biblioteca
   - Solte sobre um slot vazio (ou ocupado para substituir)
   - Foto é inserida no template

3. **Gerenciar Fotos:**

   - Hover sobre foto na biblioteca → botão "Deletar"
   - Hover sobre slot preenchido → botão "✕" para remover

4. **Admirar:**
   - O template "Coração de Memórias" forma uma composição única!
   - Compartilhe com seu parceiro(a) ❤️

---

## 🎨 Customização CSS

```css
/* Ajustar tamanho dos slots */
.album-slot {
  width: 120px;
  height: 120px;
  /* Personalizar posições em style inline */
}

/* Cores do template */
.album-template svg path {
  fill: currentColor;
  color: theme("colors.fuchsia.500/30");
}

/* Animação de drag */
.album-slot.drag-over {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(232, 121, 249, 0.5);
}
```

---

## 🤝 Contribuindo

Para adicionar novos templates:

1. Crie novo layout em `views/album/index.ejs`
2. Defina `template_id` no banco
3. Ajuste lógica de slots em `routes/album.js`
4. Adicione seletor de template na UI

---

**Versão:** 1.0.0 (MVP)  
**Data:** 2 de outubro de 2025  
**Autor:** GitHub Copilot + Luís Mendes  
**Status:** ✅ Implementado e Testado
