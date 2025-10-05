# Correções - Menu e Rota /movies

## 🐛 Problema 1: Menu hambúrguer preso na altura do header

### Causa

O menu mobile (overlay + panel) estava dentro do `<nav class="sticky top-0">`, fazendo com que ficasse preso na altura do header sticky.

### Solução

1. **Moveu o menu mobile para fora do nav**: Colocado como primeiro elemento do `<body>`, antes do `<nav>`
2. **Alpine.js global**: Componente `x-data` no nível do body
3. **Event dispatch**: Botão hambúrguer dispara evento `@toggle-mobile-menu.window`
4. **Listener window**: Menu global escuta o evento com `@toggle-mobile-menu.window`

### Resultado

- ✅ Menu mobile agora ocupa toda a altura da tela (fixed inset-0)
- ✅ Overlay cobre toda a página
- ✅ Panel desliza suavemente da direita
- ✅ z-index correto (z-40 overlay, z-50 panel)

---

## 🐛 Problema 2: TypeError: req.isAuthenticated is not a function

### Causa

A rota `/movies` estava usando `req.isAuthenticated()` que é do Passport.js, mas o projeto usa autenticação manual via sessão.

### Solução

**Antes:**

```javascript
if (!req.isAuthenticated()) {
  return res.redirect("/auth/login");
}
const userId = req.user.id;
```

**Depois:**

```javascript
const userId = req.session?.user?.id;
if (!userId) {
  return res.redirect("/auth/login");
}
```

### Resultado

- ✅ Usa o padrão de autenticação do projeto (session.user)
- ✅ Consistente com outras rotas (corner, album, etc.)
- ✅ Rota /movies funciona sem erros

---

## 📁 Arquivos Modificados

### views/layout.ejs

1. Menu mobile movido para fora do `<nav>` sticky
2. Wrapper Alpine global com `@toggle-mobile-menu.window`
3. Botão hambúrguer simplificado com `$dispatch('toggle-mobile-menu')`
4. Removido `style="display: none;"` (Alpine gerencia com `x-show`)

### src/routes/movies.js

1. Removido `req.isAuthenticated()`
2. Adicionado `req.session?.user?.id`
3. Tratamento de erro se userId não existir

---

## ✅ Status Atual

### Menu Responsivo

- Desktop: Dropdown "Mais" funcionando ✅
- Mobile: Menu hambúrguer funcional e full-screen ✅
- Animações: Suaves e consistentes ✅

### Rota /movies

- Backend: Rota funcional ✅
- Autenticação: Usando padrão correto ✅
- View: Placeholder renderizando ✅
- Tabela movies: Criada no banco ✅

---

## 🚀 Próximos Passos

1. **CRUD de filmes**: Adicionar, editar, deletar
2. **API de filmes**: Integrar TMDB ou OMDb
3. **Busca de filmes**: Input de busca com sugestões
4. **Cards de filmes**: Design com poster e informações
5. **Rating**: Sistema de estrelas
6. **Filtros**: Watchlist vs Watched
