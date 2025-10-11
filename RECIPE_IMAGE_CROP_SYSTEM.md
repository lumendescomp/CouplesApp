# Sistema de Crop de Imagens em Receitas

## 📸 Visão Geral

Sistema que permite ao usuário posicionar/cropar a imagem da receita para que apareça **exatamente igual** no card e no editor.

## 🎯 Problema Resolvido

**Antes:** Usávamos `object-position` CSS, mas a visualização era diferente em telas de tamanhos diferentes.

**Agora:** Geramos uma imagem **fisicamente cropada** no servidor usando Sharp. O que você vê no editor é o que aparece no card!

## 🏗️ Arquitetura

### Arquivos de Imagem

Para cada receita, mantemos **2 versões** da foto:

1. **Original** (`couple1_1234567890_original.jpg`)
   - Imagem completa como foi enviada
   - Usada como base para re-cropar
   - Mostrada no editor para posicionamento

2. **Cropada** (`couple1_1234567890_cropped.jpg`)
   - Imagem processada/cortada com Sharp
   - Tamanho fixo: 385x280px (aspect ratio 4:3)
   - Mostrada no card da receita
   - Armazenada em `photo_path` no banco

### Fluxo de Trabalho

```
1. UPLOAD INICIAL
   User envia foto → Salva como "couple1_XXX.jpg"
   ↓
   photo_path = /public/recipe-photos/couple1_XXX.jpg

2. PRIMEIRA EDIÇÃO/CROP
   User abre editor → Copia original como "couple1_XXX_original.jpg"
   ↓
   User posiciona imagem → Salva posição (crop_x, crop_y)
   ↓
   Sharp processa → Gera "couple1_XXX_cropped.jpg" (385x280px)
   ↓
   photo_path = /public/recipe-photos/couple1_XXX_cropped.jpg

3. RE-EDIÇÃO
   User abre editor → Carrega "couple1_XXX_original.jpg"
   ↓
   User reposiciona → Sharp processa novamente
   ↓
   Sobrescreve "couple1_XXX_cropped.jpg"
   ↓
   photo_path continua apontando para _cropped
```

## 🔧 Implementação Técnica

### Backend (`src/routes/recipes.js`)

**Rota:** `PUT /recipes/:id/crop`

**Processamento:**
1. Verifica se existe `_original`, senão cria cópia da atual
2. Lê metadados da imagem original com Sharp
3. Calcula área visível simulando `object-fit: cover`
4. Converte `crop_x` e `crop_y` (%) para offset em pixels
5. Extrai região da imagem original
6. Redimensiona para 385x280px
7. Salva como `_cropped.jpg` (qualidade 92%)
8. Atualiza `photo_path` no banco

**Exemplo de Cálculo:**

```javascript
// Imagem original: 2000x3000px (2:3 - vertical)
// Card: 385x280px (4:3 - horizontal)

// Qual área da original caberia em um container 4:3?
containerRatio = 385/280 = 1.375
imageRatio = 2000/3000 = 0.667

// Imagem é mais alta (0.667 < 1.375)
// Width preenche 100%, height é cortada
visibleWidth = 2000px (100%)
visibleHeight = 2000 / 1.375 = 1454px

// Usuário posicionou em crop_x=50%, crop_y=30%
maxOffsetY = 3000 - 1454 = 1546px
offsetY = 1546 * 0.30 = 464px

// Sharp extrai: left=0, top=464, width=2000, height=1454
// Depois redimensiona para 385x280px
```

### Frontend (`views/recipes/index.ejs`)

**Editor de Imagem:**
- Carrega imagem `_original` (se existir) ou atual
- Usa `object-position` CSS para preview em tempo real
- Ao salvar, envia `crop_x` e `crop_y` para servidor
- Servidor processa e retorna URL da imagem cropada

**Card da Receita:**
- Simplesmente mostra `photo_path` sem `object-position`
- A imagem já vem cropada no tamanho correto

### Banco de Dados

```sql
CREATE TABLE recipes (
  ...
  photo_path TEXT,           -- /public/recipe-photos/couple1_XXX_cropped.jpg
  crop_x REAL DEFAULT 50,    -- Posição X em % (0-100)
  crop_y REAL DEFAULT 50,    -- Posição Y em % (0-100)
  ...
);
```

## 📦 Dependências

- **Sharp** (`npm install sharp`)
  - Biblioteca de processamento de imagens em Node.js
  - Muito rápida (usa libvips)
  - Suporta JPEG, PNG, WebP

## ✅ Vantagens

1. **Consistência Visual**
   - O que você vê no editor é o que aparece no card
   - Não depende do tamanho da tela

2. **Performance**
   - Imagens cropadas são menores (385x280px)
   - Carregamento mais rápido
   - Menos processamento no browser

3. **Re-editável**
   - Original sempre preservada
   - Pode reposicionar quantas vezes quiser
   - Cada novo crop sobrescreve o anterior

4. **Qualidade**
   - Sharp gera imagens de alta qualidade
   - JPEG com qualidade 92%
   - Processamento server-side profissional

## 🔄 Fluxo de Dados Completo

```
FRONTEND                    BACKEND                    FILESYSTEM
   │                           │                           │
   │──posicionar imagem────────│                           │
   │   (arrastar no editor)    │                           │
   │                           │                           │
   │──enviar posição───────────│                           │
   │   crop_x: 35%             │                           │
   │   crop_y: 60%             │                           │
   │                           │                           │
   │                           │──ler original─────────────│
   │                           │   couple1_XXX_original    │
   │                           │                           │
   │                           │──calcular crop────────────│
   │                           │   extract + resize        │
   │                           │                           │
   │                           │──salvar cropada───────────│
   │                           │   couple1_XXX_cropped     │
   │                           │                           │
   │                           │──atualizar DB─────────────│
   │                           │   photo_path = _cropped   │
   │                           │                           │
   │<──retornar sucesso────────│                           │
   │   photo_path: ...cropped  │                           │
   │                           │                           │
   │──recarregar página────────│                           │
   │                           │                           │
   │──renderizar card──────────│                           │
   │   <img src="_cropped">    │                           │
```

## 🐛 Troubleshooting

**Problema:** Imagem original não encontrada
- **Causa:** Primeira edição sem ter copiado original
- **Solução:** Sistema cria cópia automaticamente

**Problema:** Crop não corresponde ao esperado
- **Causa:** Cálculo de aspect ratio incorreto
- **Solução:** Verificar logs `console.log('📸 Processando crop:...')`

**Problema:** Erro "Sharp is not installed"
- **Causa:** Sharp não instalado ou compilação falhou
- **Solução:** `npm install --build-from-source sharp`

## 📝 Manutenção

**Limpeza de Arquivos:**
- Ao deletar receita: deletar `_original` e `_cropped`
- Implementado em `DELETE /recipes/:id`

**Re-upload de Foto:**
- Deleta `_original` e `_cropped` antigos
- Nova foto vira a "original"
- Reset de `crop_x` e `crop_y` para 50%

## 🚀 Melhorias Futuras

- [ ] Suportar múltiplos formatos (PNG, WebP)
- [ ] Adicionar zoom/escala no editor
- [ ] Preview em tempo real durante arrasto
- [ ] Compressão otimizada por formato
- [ ] Cache de imagens cropadas
- [ ] Suporte para imagens de alta resolução (retina)

---

**Criado:** 11/10/2025  
**Última Atualização:** 11/10/2025  
**Autor:** Sistema CouplesApp
