import express from 'express';
import { getDb } from '../db.js';

const router = express.Router();

// Helper para pegar o casal do usuário
function getUserCouple(userId) {
  const db = getDb();
  const couple = db.prepare(`
    SELECT c.id, c.partner1_id, c.partner2_id,
           u1.username as partner1_name,
           u2.username as partner2_name
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
      SELECT cm.*, u.username as sender_name
      FROM chat_messages cm
      JOIN users u ON cm.sender_user_id = u.id
      WHERE cm.couple_id = ?
      ORDER BY cm.created_at DESC
      LIMIT 50
    `).all(couple.id);

    // Inverter para ordem cronológica
    messages.reverse();

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
      SELECT cm.*, u.username as sender_name
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
      INSERT INTO chat_messages (couple_id, sender_user_id, message)
      VALUES (?, ?, ?)
    `).run(couple.id, userId, message.trim());

    const newMessage = db.prepare(`
      SELECT cm.*, u.username as sender_name
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

export default router;
