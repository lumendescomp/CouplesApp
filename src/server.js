import "dotenv/config";
import express from "express";
import path from "path";
import morgan from "morgan";
import helmet from "helmet";
import session from "express-session";
import SQLiteStoreFactory from "connect-sqlite3";
import csrf from "csurf";
import { fileURLToPath } from "url";
import { ensureAuthed } from "./middleware/auth.js";
import expressLayouts from "express-ejs-layouts";
import { createServer } from "http";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.js";
import inviteRoutes from "./routes/invite.js";
import joinRoutes from "./routes/join.js";
import coupleRoutes from "./routes/couple.js";
import profileRoutes from "./routes/profile.js";
import cornerRoutes from "./routes/corner.js";
import albumRoutes from "./routes/album.js";
import moviesRoutes from "./routes/movies.js";
import recipesRoutes from "./routes/recipes.js";
import giftListRoutes from "./routes/gift-list.js";
import chatRoutes, { setSocketIO } from "./routes/chat.js";
import { initDb, getDb } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const SQLiteStore = SQLiteStoreFactory(session);

// Basic security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'", // Necessário para PIXI.js
          "https://cdn.tailwindcss.com",
          "https://unpkg.com",
          "https://cdn.socket.io",
        ],
        "connect-src": ["'self'", "https://unpkg.com", "https://cdn.socket.io", "ws://localhost:*", "wss://localhost:*"],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
        // Permite imagens locais, data: para ícones/toasts e TMDB para posters de filmes
        "img-src": ["'self'", "data:", "https://image.tmdb.org"],
        // Permite vídeos locais (sem data:)
        "media-src": ["'self'"],
      },
    },
  })
);

app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sessions
app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.sqlite",
      dir: path.join(__dirname, "../data"),
    }),
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

// CSRF: aplicar globalmente, exceto para POST multipart em /profile, /album/upload, /recipes e /gift-list,
// onde validaremos após o multer (pois o corpo ainda não foi processado aqui)
const csrfProtection = csrf();
app.use((req, res, next) => {
  const ct = req.headers["content-type"] || "";
  const isMultipart = ct.startsWith("multipart/form-data");
  if (
    isMultipart &&
    (req.method === "POST" || req.method === "PUT") &&
    (req.path.startsWith("/profile") || 
     req.path.startsWith("/album/upload") ||
     req.path.startsWith("/recipes") ||
     req.path.startsWith("/gift-list") ||
     req.path.startsWith("/chat/photo"))
  ) {
    return next();
  }
  return csrfProtection(req, res, next);
});

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));
app.use(expressLayouts);
app.set("layout", "layout");

// Static (if needed later)
app.use("/public", express.static(path.join(__dirname, "../public")));

// Locals used in all templates
app.use((req, res, next) => {
  const token = typeof req.csrfToken === "function" ? req.csrfToken() : "";
  res.locals.csrfToken = token;
  res.locals.currentUser = req.session.user || null;
  const host = req.get("host");
  res.locals.baseUrl = `${req.protocol}://${host}`;
  // Caminho atual para destacar links ativos no layout
  res.locals.currentPath = req.path || "/";
  next();
});

// Routes
app.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/couple");
  res.redirect("/auth/login");
});

app.use("/auth", authRoutes);
app.use("/invite", ensureAuthed, inviteRoutes);
app.use("/join", ensureAuthed, joinRoutes);
app.use("/couple", ensureAuthed, coupleRoutes);
app.use("/profile", ensureAuthed, profileRoutes);
app.use("/corner", ensureAuthed, cornerRoutes);
app.use("/album", ensureAuthed, albumRoutes);
app.use("/movies", ensureAuthed, moviesRoutes);
app.use("/recipes", ensureAuthed, recipesRoutes);
app.use("/gift-list", ensureAuthed, giftListRoutes);
app.use("/chat", ensureAuthed, chatRoutes);

// Configurar Socket.IO nas rotas do chat
setSocketIO(io);

// Socket.IO para chat em tempo real
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Entrar na sala do casal
  socket.on('join-couple', (coupleId) => {
    socket.join(`couple-${coupleId}`);
    console.log(`Socket ${socket.id} joined couple-${coupleId}`);
  });

  // Enviar mensagem
  socket.on('send-message', async (data) => {
    try {
      const { coupleId, userId, message } = data;
      
      // Salvar no banco
      const db = getDb();
      const result = db.prepare(`
        INSERT INTO chat_messages (couple_id, sender_user_id, message, message_type)
        VALUES (?, ?, ?, 'text')
      `).run(coupleId, userId, message);

      // Buscar mensagem completa com nome do usuário
      const newMessage = db.prepare(`
        SELECT cm.*, u.display_name as sender_name
        FROM chat_messages cm
        JOIN users u ON cm.sender_user_id = u.id
        WHERE cm.id = ?
      `).get(result.lastInsertRowid);

      // Broadcast para todos na sala do casal
      io.to(`couple-${coupleId}`).emit('new-message', newMessage);
      
      // Emitir notificação para o parceiro (não para quem enviou)
      const couple = db.prepare(`
        SELECT partner1_id, partner2_id FROM couples WHERE id = ?
      `).get(coupleId);
      
      const partnerId = couple.partner1_id === userId ? couple.partner2_id : couple.partner1_id;
      
      console.log(`[Chat] Emitindo notificação: sender=${userId}, recipient=${partnerId}, coupleId=${coupleId}`);
      
      // Broadcast notificação para todas as conexões do parceiro
      io.emit('new-message-notification', {
        coupleId,
        senderId: userId,
        recipientId: partnerId,
        message: newMessage
      });
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Erro ao enviar mensagem' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// 404
app.use((req, res) => {
  res.status(404).render("errors/404");
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status);
  try {
    res.render("errors/generic", { error: err });
  } catch (_) {
    res.send(`Error ${status}`);
  }
});

// Start
const PORT = process.env.PORT || 3000;
await initDb();
httpServer.listen(PORT, () =>
  console.log(`Server listening on http://localhost:${PORT}`)
);
