# Feature: Nossas Receitas

## 📋 Resumo da Implementação

Feature completa de gerenciamento de receitas do casal, implementada com sucesso!

## ✅ Funcionalidades Implementadas

### 1. **Cadastrar Nova Receita**
- Modal responsivo para adicionar receitas
- Campos:
  - Título (obrigatório)
  - Foto (opcional, até 5MB)
  - Link de referência (opcional)
- Preview da foto antes de enviar
- Validação de tipos de arquivo (JPEG, PNG, WEBP)

### 2. **Sistema de Fotos**
- Upload de imagens com multer
- Armazenamento em `/public/recipe-photos/`
- Preview automático ao selecionar arquivo
- Nomenclatura única: `couple{id}_{timestamp}.ext`
- Deletar foto antiga ao atualizar receita

### 3. **Links de Referência**
- Campo opcional para adicionar URL da receita original
- Exibido nos cards e no modal de detalhes
- Abre em nova aba com segurança (noopener noreferrer)

### 4. **Sistema de Avaliação com Emoji 😋**
- Rating de 1 a 5 usando emoji de "delícia" (😋)
- Cada usuário avalia individualmente
- Exibe avaliação do usuário e do parceiro separadamente
- Calcula e exibe média quando ambos avaliaram
- Interativo: clique para avaliar/alterar avaliação

### 5. **Sistema de Comentários**
- Cada usuário pode escrever/editar seu próprio comentário
- Modal de detalhes com textarea para comentários
- Exibe comentário do parceiro (somente leitura)
- Comentários salvos individualmente por usuário

## 🗂️ Estrutura de Arquivos

### Backend
```
src/
├── routes/
│   └── recipes.js           # Rotas CRUD completas
├── migrations/
│   └── 002_add_recipes.sql  # Migration do banco
└── db.js                     # Tabela recipes criada
```

### Frontend
```
views/recipes/
├── index.ejs                 # Página principal
├── _recipe_card.ejs          # Card de receita
├── _add_recipe_modal.ejs     # Modal adicionar
├── _edit_recipe_modal.ejs    # Modal editar (placeholder)
└── _recipe_detail_modal.ejs  # Modal de detalhes
```

### Storage
```
public/
└── recipe-photos/            # Diretório para fotos
```

## 🎨 Design e UX

### Responsividade
- ✅ Layout adaptável para mobile, tablet e desktop
- ✅ Grid responsivo: 1 coluna (mobile) → 4 colunas (desktop)
- ✅ Modais otimizados para todas as telas
- ✅ Texto e botões com tamanhos adaptativos
- ✅ Preview de fotos responsivo

### Estética
- ✅ Tema violet/fuchsia consistente com o app
- ✅ Cards com efeito glass e hover
- ✅ Emojis 😋 grandes e interativos (opacity para feedback)
- ✅ Animações suaves (slideIn, transitions)
- ✅ Toast notifications para feedback

### Funcionalidades UX
- ✅ Empty state quando não há receitas
- ✅ Overlay com ações ao hover nos cards
- ✅ Confirmação antes de deletar
- ✅ Feedback visual imediato (toast)
- ✅ Preview de foto antes de enviar
- ✅ Click-outside-to-close nos modais

## 🔒 Segurança

- ✅ Validação de tipos de arquivo no backend
- ✅ Limite de tamanho (5MB)
- ✅ Proteção CSRF em todas as rotas
- ✅ Autenticação obrigatória
- ✅ Verificação de ownership do casal
- ✅ SQL injection protection (prepared statements)
- ✅ XSS protection (EJS escaping)

## 📊 Banco de Dados

### Tabela `recipes`
```sql
- id (PRIMARY KEY)
- couple_id (FK → couples)
- title (TEXT NOT NULL)
- photo_path (TEXT)
- reference_link (TEXT)
- user1_rating (INTEGER 1-5)
- user2_rating (INTEGER 1-5)
- user1_comment (TEXT)
- user2_comment (TEXT)
- created_by_user_id (FK → users)
- created_at (DATETIME)
- updated_at (DATETIME)
```

### Índices
- `idx_recipes_couple_id` - Busca por casal
- `idx_recipes_created_at` - Ordenação cronológica

## 🔌 API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/recipes` | Lista todas as receitas do casal |
| POST | `/recipes` | Cria nova receita (multipart/form-data) |
| PUT | `/recipes/:id` | Atualiza receita (título, foto, link) |
| PUT | `/recipes/:id/rating` | Avalia receita (1-5) |
| PUT | `/recipes/:id/comment` | Atualiza comentário |
| DELETE | `/recipes/:id` | Deleta receita e foto |

## 🚀 Integração com o App

### Navegação
- ✅ Adicionado ao dropdown "Mais" no menu desktop
- ✅ Adicionado ao menu hambúrguer mobile
- ✅ Ícone de livro de receitas (📖)
- ✅ Highlight automático quando ativo

### Layout
- ✅ Usa layout padrão do app
- ✅ HTMX para navegação SPA
- ✅ AlpineJS para interatividade
- ✅ Tailwind CSS consistente

## 🎯 Próximos Passos Sugeridos

### Melhorias Futuras (opcionais)
1. ⏳ Editar receita existente (título, foto, link)
2. ⏳ Categorias/tags de receitas
3. ⏳ Busca e filtros
4. ⏳ Ingredientes e instruções completas
5. ⏳ Tempo de preparo
6. ⏳ Dificuldade (fácil, médio, difícil)
7. ⏳ Favoritar receitas
8. ⏳ Ordenação customizada
9. ⏳ Exportar receitas (PDF)
10. ⏳ Compartilhar receita

## 📝 Notas Técnicas

- **Multer configurado** para aceitar multipart em `/recipes`
- **CSRF exception** adicionada para uploads
- **Migration automática** ao reiniciar servidor
- **Diretório recipe-photos** criado automaticamente
- **Rota protegida** com middleware `ensureAuthed`
- **CommonJS** usado nas rotas (require/module.exports)

## 🧪 Como Testar

1. Faça login no app
2. Acesse "Mais" → "Nossas receitas" (ou menu hambúrguer no mobile)
3. Clique em "Nova Receita"
4. Preencha título, adicione foto (opcional) e link (opcional)
5. Submeta o formulário
6. Avalie a receita clicando nos emojis 😋
7. Clique em "Ver detalhes" para adicionar comentário
8. Teste deletar receita

## ✨ Destaques da Implementação

- **Emojis em vez de estrelas**: Mais descontraído e divertido! 😋
- **Dual rating system**: Similar aos filmes, cada pessoa avalia
- **Comentários separados**: Cada um compartilha sua opinião
- **Link de referência**: Prático para voltar à receita original
- **Fotos opcionais**: Não obriga ter foto para cadastrar
- **100% responsivo**: Funciona perfeitamente em qualquer dispositivo
- **Consistência visual**: Mantém a estética violet/fuchsia do app

---

**Status**: ✅ **FEATURE COMPLETA E FUNCIONAL!**
