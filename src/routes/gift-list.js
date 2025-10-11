import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getDb } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Configurar multer para upload de fotos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/gift-photos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = req.session?.user?.id;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `couple${userId}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'));
    }
  }
});

// Helper: buscar casal do usuário
function getUserCouple(userId) {
  const db = getDb();
  return db.prepare(`
    SELECT c.*, 
           u1.display_name as partner1_name,
           u2.display_name as partner2_name
    FROM couples c
    LEFT JOIN users u1 ON c.partner1_id = u1.id
    LEFT JOIN users u2 ON c.partner2_id = u2.id
    WHERE c.partner1_id = ? OR c.partner2_id = ?
  `).get(userId, userId);
}

// GET /gift-list - Página principal da lista de presentes
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.session?.user?.id;
    
    if (!userId) {
      return res.redirect('/auth/login');
    }

    const couple = getUserCouple(userId);

    if (!couple) {
      return res.redirect('/invite');
    }

    // Buscar presentes de ambos os parceiros
    const gifts = db.prepare(`
      SELECT 
        g.*,
        u_recipient.display_name as recipient_name,
        u_added.display_name as added_by_name
      FROM gift_list g
      LEFT JOIN users u_recipient ON g.recipient_user_id = u_recipient.id
      LEFT JOIN users u_added ON g.added_by_user_id = u_added.id
      WHERE g.couple_id = ?
      ORDER BY g.created_at DESC
    `).all(couple.id);

    // Separar presentes por destinatário
    const partner1Gifts = gifts.filter(g => g.recipient_user_id === couple.partner1_id);
    const partner2Gifts = gifts.filter(g => g.recipient_user_id === couple.partner2_id);

    res.render('gift-list/index', {
      csrfToken: req.csrfToken(),
      currentUser: req.session.user,
      currentPath: req.path,
      couple,
      partner1Gifts,
      partner2Gifts,
      isUser1: userId === couple.partner1_id
    });
  } catch (error) {
    console.error('Erro ao buscar lista de presentes:', error);
    res.status(500).render('errors/generic', { error: 'Erro ao carregar lista de presentes' });
  }
});

// POST /gift-list - Adicionar novo presente
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const db = getDb();
    const { name, link, price, recipient_user_id } = req.body;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    if (!name || !recipient_user_id) {
      return res.status(400).json({ error: 'Nome e destinatário são obrigatórios' });
    }

    const couple = getUserCouple(userId);
    if (!couple) {
      return res.status(400).json({ error: 'Você precisa estar em um relacionamento' });
    }

    // Validar que recipient_user_id é um dos parceiros
    if (recipient_user_id != couple.partner1_id && recipient_user_id != couple.partner2_id) {
      return res.status(400).json({ error: 'Destinatário inválido' });
    }

    const photoPath = req.file ? `/public/gift-photos/${req.file.filename}` : null;

    const result = db.prepare(`
      INSERT INTO gift_list (couple_id, recipient_user_id, added_by_user_id, name, link, photo_path, price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(couple.id, recipient_user_id, userId, name, link || null, photoPath, price || null);

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('Erro ao adicionar presente:', error);
    res.status(500).json({ error: 'Erro ao adicionar presente' });
  }
});

// PUT /gift-list/:id - Atualizar presente
router.put('/:id', upload.single('photo'), async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, link, price } = req.body;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const couple = getUserCouple(userId);
    if (!couple) {
      return res.status(400).json({ error: 'Você precisa estar em um relacionamento' });
    }

    // Verificar se o presente pertence ao casal
    const gift = db.prepare('SELECT * FROM gift_list WHERE id = ? AND couple_id = ?').get(id, couple.id);
    if (!gift) {
      return res.status(404).json({ error: 'Presente não encontrado' });
    }

    // Se enviou nova foto, deletar a antiga
    let photoPath = gift.photo_path;
    if (req.file) {
      if (gift.photo_path) {
        const oldPhotoPath = path.join(__dirname, '../../public', gift.photo_path.replace('/public/', ''));
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }
      photoPath = `/public/gift-photos/${req.file.filename}`;
    }

    db.prepare(`
      UPDATE gift_list 
      SET name = ?, link = ?, photo_path = ?, price = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, link || null, photoPath, price || null, id);

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar presente:', error);
    res.status(500).json({ error: 'Erro ao atualizar presente' });
  }
});

// DELETE /gift-list/:id - Remover presente
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const couple = getUserCouple(userId);
    if (!couple) {
      return res.status(400).json({ error: 'Você precisa estar em um relacionamento' });
    }

    // Verificar se o presente pertence ao casal
    const gift = db.prepare('SELECT * FROM gift_list WHERE id = ? AND couple_id = ?').get(id, couple.id);
    if (!gift) {
      return res.status(404).json({ error: 'Presente não encontrado' });
    }

    // Deletar foto se existir
    if (gift.photo_path) {
      const photoPath = path.join(__dirname, '../../public', gift.photo_path.replace('/public/', ''));
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }

    db.prepare('DELETE FROM gift_list WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover presente:', error);
    res.status(500).json({ error: 'Erro ao remover presente' });
  }
});

export default router;
