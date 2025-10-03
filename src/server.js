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
import authRoutes from "./routes/auth.js";
import inviteRoutes from "./routes/invite.js";
import joinRoutes from "./routes/join.js";
import coupleRoutes from "./routes/couple.js";
import profileRoutes from "./routes/profile.js";
import cornerRoutes from "./routes/corner.js";
import albumRoutes from "./routes/album.js";
import { initDb } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
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
          "https://cdn.tailwindcss.com",
          "https://unpkg.com",
        ],
        "connect-src": ["'self'", "https://unpkg.com"],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
        // Permite imagens locais e data: para ícones/toasts
        "img-src": ["'self'", "data:"],
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

// CSRF: aplicar globalmente, exceto para POST multipart em /profile e /album/upload,
// onde validaremos após o multer (pois o corpo ainda não foi processado aqui)
const csrfProtection = csrf();
app.use((req, res, next) => {
  const ct = req.headers["content-type"] || "";
  const isMultipart = ct.startsWith("multipart/form-data");
  if (
    isMultipart &&
    req.method === "POST" &&
    (req.path.startsWith("/profile") || req.path.startsWith("/album/upload"))
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
app.listen(PORT, () =>
  console.log(`Server listening on http://localhost:${PORT}`)
);
