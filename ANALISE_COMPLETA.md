# HeartSync - Análise Completa da Aplicação

**Data da Análise:** 2 de outubro de 2025  
**Versão:** 0.1.0  
**Autor:** GitHub Copilot

---

## 📋 Índice

1. [Respostas às Perguntas](#respostas-às-perguntas)
2. [Visão Geral do Projeto](#visão-geral-do-projeto)
3. [Arquitetura Técnica](#arquitetura-técnica)
4. [Funcionalidades Implementadas](#funcionalidades-implementadas)
5. [Estrutura do Banco de Dados](#estrutura-do-banco-de-dados)
6. [Sistema de Autenticação](#sistema-de-autenticação)
7. [Fluxo de Uso da Aplicação](#fluxo-de-uso-da-aplicação)
8. [Erros Encontrados](#erros-encontrados)
9. [Melhorias Sugeridas](#melhorias-sugeridas)
10. [Dependências e Tecnologias](#dependências-e-tecnologias)

---

## 🎯 Respostas às Perguntas

### 1. Em algum lugar está sendo usado Alpine.js? Ou apenas HTMX?

**Resposta:** **SIM, ambos estão sendo usados!**

- **Alpine.js** está sendo carregado no `layout.ejs`:
  ```html
  <script defer src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js"></script>
  ```

- **HTMX** também está presente:
  ```html
  <script src="https://unpkg.com/htmx.org@1.9.12"></script>
  ```

**Uso Atual:**
- **HTMX** é amplamente utilizado para navegação SPA, submissão de formulários e atualizações parciais de DOM
- **Alpine.js** tem um uso mínimo - o layout tem um atributo `[x-cloak]` definido no CSS, mas não há componentes Alpine.js ativos nas views analisadas
- O código JavaScript no `layout.ejs` re-inicializa Alpine após swaps do HTMX:
  ```javascript
  document.addEventListener("htmx:afterSwap", (e) => {
    if (window.Alpine && e && e.detail && e.detail.target) {
      window.Alpine.initTree(e.detail.target);
    }
  });
  ```

**Conclusão:** Alpine.js está configurado mas **subutilizado**. A aplicação funciona principalmente com HTMX e JavaScript vanilla.

### 2. Lista de Erros Encontrados

✅ **Nenhum erro de compilação ou lint detectado!**

O comando `get_errors` retornou: **"No errors found."**

**Pontos de Atenção (não são erros, mas requerem cuidado):**

1. **Segurança CSRF em uploads:** O perfil aplica CSRF após multer, o que está correto mas requer atenção em manutenções futuras
2. **Validação de dados:** Algumas validações poderiam ser mais robustas (ex: formato de e-mail, força de senha)
3. **Tratamento de erros:** Alguns endpoints retornam HTML diretamente em erros via HTMX

### 3. Lista de Melhorias Possíveis

#### 🔒 **Segurança**

1. **Validação de Senha Forte**
   - Adicionar requisitos mínimos (comprimento, caracteres especiais)
   - Implementar verificação de senhas comprometidas (Have I Been Pwned API)

2. **Rate Limiting**
   - Proteger endpoints de login/registro contra brute-force
   - Limitar criação de convites (ex: máximo 5 por dia)

3. **Sanitização de Inputs**
   - Validar e sanitizar `display_name` para prevenir XSS
   - Validar formato de datas no backend

4. **Headers de Segurança**
   - Adicionar mais headers CSP específicos
   - Implementar HSTS em produção

#### 🎨 **UX/UI**

5. **Feedback Visual**
   - Estados de loading mais claros em todas as ações
   - Animações de transição suaves entre páginas
   - Confirmação antes de deletar itens no cantinho

6. **Responsividade**
   - Testar e otimizar para tablets
   - Melhorar layout mobile do canvas isométrico

7. **Acessibilidade**
   - Adicionar mais atributos ARIA
   - Melhorar navegação por teclado
   - Adicionar textos alternativos em todas as imagens

#### 🚀 **Funcionalidades**

8. **Sistema de Notificações**
   - Notificar quando parceiro aceita convite
   - Alertas para datas importantes

9. **Backup de Dados**
   - Exportar dados do casal (JSON/PDF)
   - Importar configurações do cantinho

10. **Galeria de Fotos**
    - Upload de múltiplas fotos
    - Álbum compartilhado do casal

11. **Chat em Tempo Real**
    - Mensagens privadas entre o casal
    - Notificações push

12. **Conquistas/Badges**
    - Gamificação do relacionamento
    - Marcos temporais (1 mês, 1 ano, etc.)

#### 🔧 **Técnicas**

13. **Performance**
    - Implementar cache Redis para sessões
    - Otimizar queries do SQLite com índices adicionais
    - Lazy loading para assets do Pixi.js

14. **Testes**
    - Adicionar testes unitários (Jest/Vitest)
    - Testes de integração para rotas críticas
    - Testes E2E com Playwright

15. **CI/CD**
    - GitHub Actions para testes automatizados
    - Deploy automático em staging/produção

16. **Logging e Monitoramento**
    - Sistema de logs estruturado (Winston/Pino)
    - Monitoramento de erros (Sentry)
    - Métricas de uso (analytics)

17. **Migrações de Banco**
    - Sistema formal de migrações (migrate-up/down)
    - Versionamento de schema

18. **Internacionalização (i18n)**
    - Suporte para múltiplos idiomas
    - Formato de datas por região

#### 🎮 **Cantinho Virtual**

19. **Mais Interações**
    - Drag & drop direto do inventário para canvas
    - Snap to grid configurável
    - Múltipla seleção de itens

20. **Persistência de Vista**
    - Salvar posição de zoom/pan por usuário
    - Modo "tour" para apresentar o cantinho

21. **Colaboração em Tempo Real**
    - WebSocket para ver mudanças do parceiro ao vivo
    - Cursor do parceiro visível no canvas

22. **Mais Itens**
    - Expandir catálogo de móveis
    - Itens personalizáveis (textos, fotos)
    - Pets/animais de estimação virtuais

---

## 🌟 Visão Geral do Projeto

**HeartSync** é uma aplicação web para casais que oferece:

1. **Sistema de Pareamento Seguro:** Convites únicos com expiração
2. **Perfil Compartilhado:** Informações e fotos do casal
3. **Contador de Relacionamento:** Calcula tempo juntos com precisão
4. **Cantinho Virtual Isométrico:** Espaço 2.5D personalizável com móveis e decoração

### Proposta de Valor

- **Privacidade:** Cada casal tem seu espaço isolado
- **Simplicidade:** Interface intuitiva sem curva de aprendizado
- **Criatividade:** Canvas isométrico permite expressão única
- **Conexão:** Ferramenta digital para fortalecer laços

---

## 🏗️ Arquitetura Técnica

### Stack Tecnológico

```
Frontend:
├── HTML/EJS (templating server-side)
├── Tailwind CSS (via CDN) - Estilização
├── HTMX 1.9.12 - Navegação SPA e AJAX
├── Alpine.js 3.x - Reatividade (configurado, pouco usado)
├── Pixi.js 7.x - Engine de renderização 2D/isométrica
└── JavaScript Vanilla - Lógica customizada

Backend:
├── Node.js (ES Modules)
├── Express 4.19.2 - Framework web
├── EJS 3.1.10 - View engine
├── Better-SQLite3 9.4.3 - Database
├── bcryptjs 2.4.3 - Hash de senhas
├── Multer 1.4.5 - Upload de arquivos
├── Helmet 7.1.0 - Headers de segurança
├── CSURF 1.11.0 - Proteção CSRF
└── Express-Session 1.17.3 - Gerenciamento de sessão

Database:
└── SQLite 3 (modo WAL)
    ├── app.sqlite - Dados principais
    └── sessions.sqlite - Sessões
```

### Estrutura de Pastas

```
CouplesAPP/
├── data/                    # Banco de dados SQLite
│   ├── app.sqlite
│   └── sessions.sqlite
├── public/                  # Assets estáticos
│   ├── assets/atlas/        # Sprites do cantinho (300+ imagens)
│   └── uploads/             # Avatares de usuários
├── src/                     # Código-fonte backend
│   ├── middleware/
│   │   └── auth.js          # Middleware de autenticação
│   ├── migrations/
│   │   └── init.sql         # Schema inicial
│   ├── routes/              # Rotas da aplicação
│   │   ├── auth.js
│   │   ├── corner.js
│   │   ├── couple.js
│   │   ├── invite.js
│   │   ├── join.js
│   │   └── profile.js
│   ├── utils/
│   │   └── code.js          # Geração de códigos
│   ├── db.js                # Configuração do SQLite
│   ├── postinstall.js       # Script pós-instalação
│   └── server.js            # Entry point
└── views/                   # Templates EJS
    ├── auth/                # Login e registro
    ├── corner/              # Cantinho virtual
    ├── couple/              # Dashboard do casal
    ├── errors/              # Páginas de erro
    ├── invite/              # Geração de convites
    ├── join/                # Aceitar convites
    ├── profile/             # Perfil do usuário
    ├── include.ejs          # Helpers EJS
    └── layout.ejs           # Layout principal
```

---

## ⚙️ Funcionalidades Implementadas

### 1. **Autenticação e Registro**

#### Registro (`/auth/register`)
- Cadastro com e-mail e senha
- Hash bcrypt (salt rounds: 10)
- Validação de e-mail único
- Redirecionamento automático para `/invite` após criação

#### Login (`/auth/login`)
- Autenticação por credenciais
- Sessão HTTP-only cookie
- Carregamento automático do `coupleId` se existir
- Suporte a `returnTo` para deep-linking

#### Logout (`/auth/logout`)
- Destruição da sessão
- Redirecionamento para login

### 2. **Sistema de Convites**

#### Criação de Convites (`POST /invite/create`)
- Código alfanumérico de 8 caracteres
- Alfabeto sem ambiguidade: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
- Validade: 24 horas
- Uso único (marcado com `used_at` após aceite)
- Retorna fragment HTMX para atualização dinâmica

#### Listar Convites (`GET /invite`)
- Exibe apenas convites ativos (não usados, não expirados)
- Interface de cópia de código com feedback visual
- Toast de confirmação

#### Compartilhamento
- URL completa gerada: `${baseUrl}/join?code=XXXXXXXX`
- Cópia para clipboard com fallback para navegadores antigos

### 3. **Aceitar Convite e Pareamento**

#### Join (`GET /join?code=XXXXXXXX`)
- Interface para inserir código manualmente ou via link

#### Validações (`POST /join`)
1. Usuário já está em um casal → erro
2. Código inexistente → erro
3. Código já usado → erro
4. Código expirado → erro
5. Tentativa de usar próprio código → erro
6. Emissor já está pareado com outro → erro

#### Transação de Pareamento
```javascript
// Pseudo-código do fluxo
BEGIN TRANSACTION
  IF emissor não tem couple:
    INSERT INTO couples (partner1 = emissor, partner2 = eu)
  ELSE IF emissor tem couple incompleto:
    UPDATE couples SET partner2 = eu WHERE id = coupleId
  
  UPDATE invites SET used_at = NOW(), used_by_user_id = eu
COMMIT
```

### 4. **Dashboard do Casal**

#### Página Principal (`GET /couple`)
- Exibe informações do parceiro (avatar, nome)
- Formulário para definir data de início do relacionamento

#### Contador de Tempo
- **Entrada:** Data no formato `YYYY-MM-DD` ou `DD/MM/YYYY`
- **Cálculo:**
  - Anos completos (considera dia/mês)
  - Meses restantes (após anos)
  - Dias restantes (após meses)
- **Atualização:** Cliente-side, re-calcula a cada minuto
- **Persistência:** `POST /couple/start-date`

**Lógica de Cálculo (Detalhada):**
```javascript
// Exemplo: início 15/03/2023, hoje 02/10/2025
// Anos: 2025 - 2023 = 2, mas outubro > março e 02 < 15 não, então 2 anos
// Depois de 15/03/2025: restam meses até 02/10/2025 = 6 meses completos
// Depois de 15/09/2025: restam dias até 02/10/2025 = 17 dias
```

### 5. **Perfil do Usuário**

#### Edição (`GET /profile`, `POST /profile`)
- **Nome de exibição:** Máximo 60 caracteres
- **Avatar:**
  - Upload via Multer
  - Formatos: PNG, JPG, JPEG, GIF, WebP
  - Tamanho máximo: 2MB
  - Armazenamento: `/public/uploads/u{id}_{timestamp}.ext`
- **CSRF:** Aplicado após parse do multipart

#### Exibição
- Avatar padrão SVG se não houver upload
- Mostrado no dashboard do casal e navegação

### 6. **Nosso Cantinho (Canvas Isométrico)**

#### Engine de Renderização
- **Pixi.js 7.x:** WebGL com fallback para Canvas2D
- **Projeção Isométrica:**
  - Grade: 20x20 células
  - Tile: 72px largura × 36px altura
  - Ângulo: Losango isométrico clássico (26.565°)
- **Coordenadas:** Percentual (0-100%) mapeado para grid (0-19, step 0.25)

#### Tipos de Itens

1. **Móveis Decorativos**
   - Atlas com 300+ sprites PNG
   - Exemplos: mesa, cadeira, sofá, TV, planta, luminária
   - Transformações: rotação, escala, flip, tilt, stretch

2. **Piso (Tile)**
   - Desenho vetorial (Graphics API)
   - Forma: Losango isométrico
   - Cor customizável (0xRRGGBB)

3. **Parede**
   - Desenho vetorial extrudado
   - Alinhamento às direções da malha (26.565°, 153.435°, 206.565°, 333.435°)
   - Altura fixa visual (144px = 4 tiles)
   - Comprimento controlado por `scale * stretch_x`
   - Cor customizável

#### Interações

**Adicionar Item (`POST /corner/items`)**
```json
{
  "item_key": "chair",
  "x": 50,        // % horizontal (0-100)
  "y": 50,        // % vertical (0-100)
  "z": 0,         // camadas de altura (0-20)
  "rotation": 0,  // graus (0-359)
  "scale": 1.0    // escala uniforme (0.25-2.0)
}
```

**Mover Item (Drag & Drop)**
- Clique e arraste no canvas
- Snap to grid (0.25 de resolução)
- `POST /corner/items/:id/position` ao soltar

**Transformações Avançadas**
- **Nudge:** `POST /corner/items/:id/nudge` (dx, dy, drot)
- **Altura:** `POST /corner/items/:id/height` (dz ±1)
- **Escala:** `POST /corner/items/:id/scale` (0.25-2.0)
- **Stretch:** `POST /corner/items/:id/stretch` (stretch_x, stretch_y: 0.25-3.0)
- **Tilt/Skew:** `POST /corner/items/:id/tilt` (tilt_x, tilt_y: -60 a +60 graus)
- **Flip:** `POST /corner/items/:id/flip` (flip_x, flip_y: 0/1)
- **Cor:** `POST /corner/items/:id/color` (para piso/parede)

**Camadas (Z-Order)**
- **Layer automático:** Sorting por posição Y (profundidade isométrica)
- **Layer manual:** `POST /corner/items/:id/layer` (inteiro -1000 a +1000)
- **Stack:** Enviar para trás/frente (`POST /corner/items/:id/stack`, dir: ±1)

**Controles de Usuário**
- **Seleção:** Clique em item → overlay de controles aparece
- **Deletar:** Botão 🗑 no overlay → `POST /corner/items/:id/delete`
- **Zoom:** Botões +/- ou scroll (0.25x - 2.0x)
- **Pan:** Botão do meio do mouse ou Space + drag
- **Atalhos de Teclado:**
  - `Q/E`: Rotação ±15°
  - `T/G`: Tilt X ±5°
  - `Y/H`: Tilt Y ±5°
  - `F`: Flip horizontal
  - `V`: Flip vertical
  - `Delete`: Remover item selecionado
  - `Shift + Scroll`: Escala rápida
  - `Ctrl/Alt + Scroll`: Rotação fina

**Cores Globais (`POST /corner/colors`)**
- Canvas (fundo externo)
- Chão (piso da sala)
- Parede (bordas superiores)
- Preview em tempo real (oninput), persistência no onchange

**Inventário**
- Busca filtrada client-side
- Grupos de categorias (futuro: por tipo de móvel)
- Duplo clique para adicionar item ao canvas

#### Persistência
- Todos os itens salvos em `couple_items` table
- Sincronização automática após cada ação
- Estado completo recarregado ao entrar na página

---

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

#### **users**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,              -- Nome exibível (máx 60 chars)
  avatar_path TEXT,               -- Caminho relativo ou absoluto da foto
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_users_email ON users(email);
```

#### **couples**
```sql
CREATE TABLE couples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner1_id INTEGER NOT NULL,  -- Sempre preenchido
  partner2_id INTEGER,            -- NULL até aceite de convite
  relationship_start_date TEXT,  -- YYYY-MM-DD
  corner_canvas_color INTEGER,   -- 0xRRGGBB (fundo)
  corner_floor_color INTEGER,    -- 0xRRGGBB (piso)
  corner_wall_color INTEGER,     -- 0xRRGGBB (paredes)
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (partner1_id) REFERENCES users(id),
  FOREIGN KEY (partner2_id) REFERENCES users(id)
);
```

#### **invites**
```sql
CREATE TABLE invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,        -- 8 chars alfanuméricos
  issuer_user_id INTEGER NOT NULL,  -- Quem criou
  expires_at TEXT NOT NULL,         -- datetime de expiração
  used_at TEXT,                     -- NULL se não usado
  used_by_user_id INTEGER,          -- Quem aceitou
  created_couple_id INTEGER,        -- ID do couple criado/atualizado
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (issuer_user_id) REFERENCES users(id),
  FOREIGN KEY (used_by_user_id) REFERENCES users(id),
  FOREIGN KEY (created_couple_id) REFERENCES couples(id)
);
CREATE INDEX idx_invites_code ON invites(code);
```

#### **couple_items**
```sql
CREATE TABLE couple_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  couple_id INTEGER NOT NULL,
  item_key TEXT NOT NULL,        -- Chave do sprite (ex: "chair", "sofa")
  x INTEGER NOT NULL DEFAULT 50, -- Posição % horizontal (0-100)
  y INTEGER NOT NULL DEFAULT 50, -- Posição % vertical (0-100)
  z INTEGER NOT NULL DEFAULT 0,  -- Altura (camadas 0-20)
  rotation INTEGER NOT NULL DEFAULT 0,    -- Graus (0-359)
  scale REAL NOT NULL DEFAULT 1.0,        -- Escala uniforme (0.25-2.0)
  layer INTEGER NOT NULL DEFAULT 0,       -- Z-index manual (-1000 a +1000)
  tilt_x REAL NOT NULL DEFAULT 0,         -- Skew X em graus (-60 a +60)
  tilt_y REAL NOT NULL DEFAULT 0,         -- Skew Y em graus (-60 a +60)
  flip_x INTEGER NOT NULL DEFAULT 0,      -- Espelhar horizontal (0/1)
  flip_y INTEGER NOT NULL DEFAULT 0,      -- Espelhar vertical (0/1)
  stretch_x REAL NOT NULL DEFAULT 1.0,    -- Escala não-uniforme X (0.25-3.0)
  stretch_y REAL NOT NULL DEFAULT 1.0,    -- Escala não-uniforme Y (0.25-3.0)
  color INTEGER,                          -- 0xRRGGBB opcional (piso/parede)
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (couple_id) REFERENCES couples(id)
);
CREATE INDEX idx_couple_items_couple ON couple_items(couple_id);
```

### Migrações Condicionais

O sistema verifica e adiciona colunas dinamicamente se ausentes:
```javascript
// Exemplo em db.js
const cols = db.prepare("PRAGMA table_info(users)").all();
const names = new Set(cols.map((c) => c.name));
if (!names.has("display_name")) {
  db.exec("ALTER TABLE users ADD COLUMN display_name TEXT");
}
```

---

## 🔐 Sistema de Autenticação

### Sessões

**Armazenamento:** SQLite (`sessions.sqlite`)
```javascript
session({
  store: new SQLiteStore({
    db: "sessions.sqlite",
    dir: "./data",
  }),
  secret: process.env.SESSION_SECRET || "dev-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,      // JavaScript não pode acessar
    sameSite: "lax",     // Proteção CSRF básica
    secure: false,       // TRUE em produção com HTTPS
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
  },
})
```

### CSRF Protection

**Implementação:** `csurf` middleware
- Token único por sessão
- Enviado em `<meta name="csrf-token">`
- HTMX anexa automaticamente em `X-CSRF-Token` header
- Multipart/form-data: CSRF aplicado após multer

### Middleware de Autenticação

```javascript
// ensureAuthed: Redireciona para login se não autenticado
export function ensureAuthed(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.session) {
    req.session.returnTo = req.originalUrl; // Deep-linking
  }
  return res.redirect("/auth/login");
}

// requireNoCouple: Apenas para usuários sem casal formado
export function requireNoCouple(req, res, next) {
  if (req.session?.user && !req.session.user.coupleId) return next();
  return res.redirect("/couple");
}
```

### Proteção de Rotas

```javascript
app.use("/invite", ensureAuthed, inviteRoutes);
app.use("/join", ensureAuthed, joinRoutes);
app.use("/couple", ensureAuthed, coupleRoutes);
app.use("/profile", ensureAuthed, profileRoutes);
app.use("/corner", ensureAuthed, cornerRoutes);
```

---

## 🔄 Fluxo de Uso da Aplicação

### 1️⃣ **Novo Usuário (Primeira Pessoa)**

```
1. Acessa HeartSync → Redireciona para /auth/login
2. Clica em "Criar conta"
3. Preenche e-mail e senha → POST /auth/register
4. Sistema cria user e session
5. Redireciona para /invite
6. Clica "Gerar novo código"
7. Código aparece (ex: KJH23P9A)
8. Copia link completo ou código
9. Envia para parceiro(a) via WhatsApp/SMS
```

### 2️⃣ **Parceiro(a) (Segunda Pessoa)**

```
1. Recebe link ou código
2. Acessa HeartSync → Redireciona para /auth/login
3. Cria conta → POST /auth/register
4. Redireciona para /invite (mas não precisa gerar)
5. Navega para "Encontrar meu par" → /join
6. Cola código (ou link já preenche)
7. Clica "Conectar" → POST /join
8. Sistema valida e cria/completa couple
9. Redireciona para /couple
```

### 3️⃣ **Casal Formado**

```
Dashboard (/couple):
├─ Define data de início do relacionamento
├─ Vê contador de tempo juntos
└─ Vê informações do parceiro

Perfil (/profile):
├─ Atualiza nome de exibição
└─ Faz upload de avatar

Nosso Cantinho (/corner):
├─ Adiciona móveis e decoração
├─ Arrasta e posiciona items
├─ Customiza cores do ambiente
├─ Transforma items (escala, rotação, etc.)
└─ Cria seu espaço único
```

### 4️⃣ **Navegação Contínua (SPA)**

- HTMX gerencia navegação sem reload
- URLs atualizadas via `hx-push-url="true"`
- Estado da sessão mantido
- Highlight de link ativo atualizado via JavaScript

---

## 🐛 Erros Encontrados

### ✅ Análise de Erros de Compilação/Lint

**Resultado:** Nenhum erro detectado!

```
get_errors() → "No errors found."
```

### ⚠️ Pontos de Atenção (Não são erros críticos)

1. **Segurança CSRF em Uploads**
   - **Localização:** `src/routes/profile.js`
   - **Situação:** CSRF aplicado após multer (correto, mas específico)
   - **Risco:** Baixo, mas requer documentação para manutenção

2. **Validação de Dados**
   - **E-mail:** Apenas unique constraint no DB, sem regex de validação
   - **Senha:** Sem requisitos de força (comprimento, caracteres)
   - **Impacto:** Usuários podem criar senhas fracas

3. **Tratamento de Erros HTMX**
   - Alguns endpoints retornam HTML em vez de JSON para erros
   - **Exemplo:** `/join` retorna `<div class="text-red-600">Erro</div>`
   - **Impacto:** Funciona com HTMX, mas dificulta testes automatizados

4. **Ausência de Rate Limiting**
   - Endpoints públicos `/auth/login` e `/auth/register` sem limite
   - **Risco:** Vulnerável a brute-force

5. **Sessão Não-Secure por Padrão**
   - `cookie.secure: false` no código
   - **Justificativa:** Dev local sem HTTPS
   - **Ação:** Mudar para `true` em produção

---

## 💡 Melhorias Sugeridas (Detalhadas)

### 🔒 Categoria: Segurança

#### 1. Validação de Senha Forte

**Problema:** Usuários podem criar senhas como "123456"

**Solução:**
```javascript
// src/utils/password.js
export function validatePassword(pw) {
  if (pw.length < 8) return "Mínimo 8 caracteres";
  if (!/[A-Z]/.test(pw)) return "Inclua ao menos uma maiúscula";
  if (!/[a-z]/.test(pw)) return "Inclua ao menos uma minúscula";
  if (!/[0-9]/.test(pw)) return "Inclua ao menos um número";
  return null; // OK
}

// Em routes/auth.js
const pwError = validatePassword(password);
if (pwError) return res.status(400).render("auth/register", { error: pwError });
```

**Prioridade:** Alta  
**Esforço:** Baixo (1-2h)

---

#### 2. Rate Limiting

**Problema:** Ataques de força bruta em login

**Solução:**
```bash
npm install express-rate-limit
```

```javascript
// src/server.js
import rateLimit from "express-rate-limit";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5, // 5 tentativas
  message: "Muitas tentativas. Tente novamente em 15 minutos.",
});

app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);
```

**Prioridade:** Alta  
**Esforço:** Baixo (1h)

---

#### 3. Sanitização de Display Name

**Problema:** XSS via nome de exibição malicioso

**Solução:**
```bash
npm install sanitize-html
```

```javascript
// src/routes/profile.js
import sanitizeHtml from "sanitize-html";

const displayName = sanitizeHtml(req.body.display_name || "", {
  allowedTags: [],
  allowedAttributes: {},
}).trim().slice(0, 60);
```

**Prioridade:** Média  
**Esforço:** Baixo (30min)

---

### 🎨 Categoria: UX/UI

#### 4. Loading States

**Problema:** Usuário não sabe se ação foi registrada

**Solução HTMX:**
```html
<!-- Adicionar em botões -->
<button
  hx-post="/invite/create"
  hx-indicator="#spinner"
>
  Gerar código
</button>
<div id="spinner" class="htmx-indicator">Carregando...</div>

<style>
  .htmx-indicator { display: none; }
  .htmx-request .htmx-indicator { display: inline-block; }
</style>
```

**Prioridade:** Média  
**Esforço:** Médio (2-3h para todos os botões)

---

#### 5. Confirmação de Deleção

**Problema:** Fácil deletar item por acidente

**Solução:**
```javascript
// Em views/corner/index.ejs
if (btnDel) {
  btnDel.onclick = async (e) => {
    e.stopPropagation();
    if (!confirm("Remover este item?")) return;
    await deleteItem(idSel);
    overlay.classList.add("hidden");
  };
}
```

**Prioridade:** Baixa  
**Esforço:** Baixo (15min)

---

### 🚀 Categoria: Funcionalidades

#### 6. Sistema de Notificações

**Visão:**
- Notificar quando parceiro aceita convite
- Alertas para aniversários de relacionamento

**Stack Sugerida:**
- WebSockets (Socket.io) ou Server-Sent Events (SSE)
- Web Push API para notificações do navegador

**Esforço:** Alto (1-2 semanas)

---

#### 7. Chat em Tempo Real

**Visão:**
- Mensagens privadas entre o casal
- Histórico persistido

**Stack:**
```bash
npm install socket.io
```

**Estrutura:**
```javascript
// Nova tabela
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  couple_id INTEGER,
  sender_user_id INTEGER,
  text TEXT,
  created_at TEXT,
  FOREIGN KEY (couple_id) REFERENCES couples(id)
);
```

**Esforço:** Alto (2-3 semanas)

---

#### 8. Galeria de Fotos

**Visão:**
- Upload de múltiplas fotos por vez
- Grid/carrossel de visualização
- Legendas e datas

**Desafios:**
- Tamanho de armazenamento (considerar S3/Cloudinary)
- Thumbnails automáticos

**Esforço:** Médio (1 semana)

---

### 🔧 Categoria: Técnicas

#### 9. Testes Unitários

**Framework Sugerido:** Vitest (compatível com ES Modules)

```bash
npm install -D vitest
```

**Exemplo:**
```javascript
// tests/utils/code.test.js
import { describe, it, expect } from "vitest";
import { generateInviteCode } from "../src/utils/code.js";

describe("generateInviteCode", () => {
  it("gera código de 8 caracteres", () => {
    const code = generateInviteCode(8);
    expect(code).toHaveLength(8);
  });

  it("usa apenas caracteres válidos", () => {
    const code = generateInviteCode(100);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });
});
```

**Prioridade:** Alta (para escalabilidade)  
**Esforço:** Alto (1-2 semanas para cobertura inicial)

---

#### 10. CI/CD com GitHub Actions

**Exemplo de Workflow:**
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm test
```

**Prioridade:** Média  
**Esforço:** Baixo (2-3h configuração inicial)

---

#### 11. Logging Estruturado

**Problema:** `console.log` dificulta debug em produção

**Solução:**
```bash
npm install pino pino-pretty
```

```javascript
// src/logger.js
import pino from "pino";

export const logger = pino({
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty" }
    : undefined,
});

// Uso
logger.info({ userId: 123 }, "Usuário fez login");
logger.error({ err: error }, "Erro ao salvar item");
```

**Prioridade:** Média  
**Esforço:** Médio (3-4h para substituir console.log)

---

#### 12. Migrações Formais

**Problema:** ALTER TABLE condicional é frágil

**Solução:**
```bash
npm install better-sqlite3-migrations
```

**Estrutura:**
```
src/migrations/
├── 001-initial.sql
├── 002-add-display-name.sql
└── 003-add-corner-colors.sql
```

**Prioridade:** Média  
**Esforço:** Médio (1 semana para reestruturar)

---

### 🎮 Categoria: Cantinho Virtual

#### 13. Colaboração em Tempo Real

**Visão:**
- Ver cursor do parceiro no canvas
- Mudanças instantâneas via WebSocket

**Implementação:**
```javascript
// WebSocket broadcast
socket.on("item-moved", (data) => {
  socket.to(coupleRoom).emit("item-moved", data);
});

// Cliente atualiza sem refetch
socket.on("item-moved", (data) => {
  addOrUpdateItem(data.item);
});
```

**Prioridade:** Baixa (feature "wow")  
**Esforço:** Alto (2 semanas)

---

#### 14. Expandir Catálogo de Items

**Ações:**
1. Criar mais sprites ou buscar packs gratuitos (itch.io)
2. Organizar por categorias no inventário
3. Adicionar filtros (móveis, decoração, plantas, etc.)

**Prioridade:** Média  
**Esforço:** Contínuo (design de assets é custoso)

---

#### 15. Items com Texto/Imagens Personalizadas

**Visão:**
- Quadro com foto do casal
- Bilhete com mensagem customizada

**Desafios:**
- Renderizar texto no Pixi.js (Text sprite)
- Upload e redimensionamento de imagens

**Prioridade:** Baixa  
**Esforço:** Alto (1-2 semanas)

---

## 📦 Dependências e Tecnologias

### Produção (`dependencies`)

| Pacote | Versão | Propósito |
|--------|--------|-----------|
| **bcryptjs** | 2.4.3 | Hash de senhas |
| **better-sqlite3** | 9.4.3 | Database SQLite síncrono |
| **connect-sqlite3** | 0.9.15 | Store de sessões para SQLite |
| **csurf** | 1.11.0 | Proteção CSRF |
| **ejs** | 3.1.10 | Template engine |
| **express** | 4.19.2 | Framework web |
| **express-ejs-layouts** | 2.5.1 | Layouts para EJS |
| **express-session** | 1.17.3 | Gerenciamento de sessão |
| **helmet** | 7.1.0 | Headers de segurança |
| **morgan** | 1.10.0 | Logger HTTP |
| **multer** | 1.4.5-lts.1 | Upload de arquivos |

### Desenvolvimento (`devDependencies`)

| Pacote | Versão | Propósito |
|--------|--------|-----------|
| **nodemon** | 3.1.0 | Hot reload em desenvolvimento |

### CDN (Frontend)

| Biblioteca | Versão | Propósito |
|------------|--------|-----------|
| **Tailwind CSS** | latest (CDN) | Estilização utilitária |
| **HTMX** | 1.9.12 | Navegação AJAX/SPA |
| **Alpine.js** | 3.x | Reatividade (configurado) |
| **Pixi.js** | 7.x | Engine de renderização 2D |
| **Pixi Unsafe Eval** | 7.x | Compatibilidade CSP |

---

## 🎯 Conclusão

**HeartSync** é uma aplicação bem estruturada com:

✅ **Arquitetura sólida** - Separação clara de responsabilidades  
✅ **Stack moderna e simples** - Zero build-step, fácil manutenção  
✅ **Funcionalidades únicas** - Cantinho isométrico é diferencial  
✅ **Segurança básica implementada** - CSRF, bcrypt, helmet  
✅ **Código limpo** - Sem erros de lint detectados  

**Oportunidades de crescimento:**
- Expandir testes automatizados
- Adicionar recursos sociais (notificações, chat)
- Melhorar performance e escalabilidade
- Diversificar catálogo de items do cantinho

**Viabilidade comercial:**
- MVP funcional e apresentável
- Potencial para freemium (items premium)
- Nicho específico (casais à distância)

---

## 📄 Licença e Metadata

- **Nome do Projeto:** HeartSync (CouplesApp)
- **Versão:** 0.1.0
- **Repositório:** lumendescomp/CouplesApp
- **Branch Atual:** main
- **Última Análise:** 2 de outubro de 2025
- **Analista:** GitHub Copilot

---

**Fim do Documento**
