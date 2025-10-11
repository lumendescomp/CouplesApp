import express from 'express';
import { getDb } from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configuração do multer para upload de fotos do chat
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/chat-photos'));
  },
  filename: (req, file, cb) => {
    const userId = req.session?.user?.id || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `couple${userId}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou GIF.'));
    }
  }
});

// Variável para armazenar a instância do Socket.IO
let io = null;

// Função para configurar o Socket.IO
export function setSocketIO(socketIO) {
  io = socketIO;
}

// Helper para buscar o casal do usuário
function getUserCouple(userId) {
  const db = getDb();
  const couple = db.prepare(`
    SELECT c.id, c.partner1_id, c.partner2_id,
           u1.display_name as partner1_name,
           u2.display_name as partner2_name
    FROM couples c
    JOIN users u1 ON c.partner1_id = u1.id
    JOIN users u2 ON c.partner2_id = u2.id
    WHERE c.partner1_id = ? OR c.partner2_id = ?
  `).get(userId, userId);
  return couple;
}

// GET /chat - Página do chat
router.get('/', (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.redirect('/auth/login');
    }

    const couple = getUserCouple(userId);
    if (!couple) {
      return res.status(400).render('errors/generic', {
        message: 'Você precisa estar em um relacionamento para acessar o chat'
      });
    }

    // Buscar últimas 50 mensagens
    const db = getDb();
    const messages = db.prepare(`
      SELECT cm.*, u.display_name as sender_name
      FROM chat_messages cm
      JOIN users u ON cm.sender_user_id = u.id
      WHERE cm.couple_id = ?
      ORDER BY cm.created_at DESC
      LIMIT 50
    `).all(couple.id);

    // Inverter para ordem cronológica
    messages.reverse();

    // Se for AJAX, renderiza só o conteúdo do chat (sem layout)
    if (req.get('X-Requested-With') === 'XMLHttpRequest') {
      return res.render('chat/index', {
        couple,
        messages,
        currentUser: req.session.user,
        layout: false
      });
    }
    // Caso contrário, renderiza normalmente (com layout)
    res.render('chat/index', {
      couple,
      messages,
      currentUser: req.session.user
    });
  } catch (error) {
    console.error('Erro ao carregar chat:', error);
    res.status(500).render('errors/generic', { message: 'Erro ao carregar chat' });
  }
});

// GET /chat/messages - API para buscar mensagens (ajax)
router.get('/messages', (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const couple = getUserCouple(userId);
    if (!couple) {
      return res.status(400).json({ error: 'Você precisa estar em um relacionamento' });
    }

    const db = getDb();
    const messages = db.prepare(`
      SELECT cm.*, u.display_name as sender_name
      FROM chat_messages cm
      JOIN users u ON cm.sender_user_id = u.id
      WHERE cm.couple_id = ?
      ORDER BY cm.created_at DESC
      LIMIT 50
    `).all(couple.id);

    messages.reverse();
    res.json({ messages });
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
});

// GET /chat/unread-count - Contar mensagens não lidas
router.get('/unread-count', (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.json({ count: 0 });
    }

    const couple = getUserCouple(userId);
    if (!couple) {
      return res.json({ count: 0 });
    }

    const db = getDb();
    // Por enquanto, retornar 0 (pode implementar sistema de leitura depois)
    // Para implementar: adicionar coluna last_read_at em uma tabela de participantes
    const count = 0;

    res.json({ count });
  } catch (error) {
    console.error('Erro ao contar mensagens não lidas:', error);
    res.json({ count: 0 });
  }
});

// POST /chat/messages - Enviar mensagem (para fallback sem websocket)
router.post('/messages', (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Mensagem vazia' });
    }

    const couple = getUserCouple(userId);
    if (!couple) {
      return res.status(400).json({ error: 'Você precisa estar em um relacionamento' });
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO chat_messages (couple_id, sender_user_id, message, message_type)
      VALUES (?, ?, ?, 'text')
    `).run(couple.id, userId, message.trim());

    const newMessage = db.prepare(`
      SELECT cm.*, u.display_name as sender_name
      FROM chat_messages cm
      JOIN users u ON cm.sender_user_id = u.id
      WHERE cm.id = ?
    `).get(result.lastInsertRowid);

    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

// POST /chat/photo - Enviar foto
router.post('/photo', upload.single('photo'), (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma foto enviada' });
    }

    const couple = getUserCouple(userId);
    if (!couple) {
      return res.status(400).json({ error: 'Você precisa estar em um relacionamento' });
    }

    const photoPath = `/public/chat-photos/${req.file.filename}`;
    const caption = req.body.caption || '';

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO chat_messages (couple_id, sender_user_id, message, photo_path, message_type)
      VALUES (?, ?, ?, ?, 'photo')
    `).run(couple.id, userId, caption, photoPath);

    const newMessage = db.prepare(`
      SELECT cm.*, u.display_name as sender_name
      FROM chat_messages cm
      JOIN users u ON cm.sender_user_id = u.id
      WHERE cm.id = ?
    `).get(result.lastInsertRowid);

    // Emitir via Socket.IO para atualização em tempo real
    if (io) {
      io.to(`couple-${couple.id}`).emit('new-message', newMessage);
      
      // Emitir notificação para o parceiro
      const coupleData = db.prepare(`
        SELECT partner1_id, partner2_id FROM couples WHERE id = ?
      `).get(couple.id);
      
      const partnerId = coupleData.partner1_id === userId ? coupleData.partner2_id : coupleData.partner1_id;
      
      io.emit('new-message-notification', {
        coupleId: couple.id,
        senderId: userId,
        recipientId: partnerId,
        message: newMessage
      });
    }

    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Erro ao enviar foto:', error);
    res.status(500).json({ error: 'Erro ao enviar foto' });
  }
});

export default router;
