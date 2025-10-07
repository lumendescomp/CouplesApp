import express from 'express';
import { getDb } from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Helper para buscar casal do usuário
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

// Configurar multer para upload de fotos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../public/recipe-photos');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const userId = req.session?.user?.id;
    const couple = userId ? getUserCouple(userId) : null;
    const coupleId = couple?.id || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `couple${coupleId}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk = allowed.test(file.mimetype);
    const extOk = allowed.test(ext.slice(1));
    if (mimeOk && extOk) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas (JPEG, PNG, WEBP)'));
    }
  }
});

// GET /recipes - Listar todas as receitas do casal
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const userId = req.session?.user?.id;
    
    if (!userId) {
      return res.redirect('/auth/login');
    }

    // Buscar o casal do usuário
    const couple = getUserCouple(userId);

    if (!couple) {
      return res.redirect('/invite');
    }

    const coupleId = couple.id;

    // Buscar todas as receitas
    const recipes = db.prepare(`
      SELECT 
        r.*,
        u.display_name as created_by_name
      FROM recipes r
      LEFT JOIN users u ON r.created_by_user_id = u.id
      WHERE r.couple_id = ?
      ORDER BY r.created_at DESC
    `).all(coupleId);

    // Adicionar informações de rating por usuário
    const recipesWithRatings = recipes.map(recipe => {
      const isUser1 = userId === couple.partner1_id;
      return {
        ...recipe,
        currentUserRating: isUser1 ? recipe.user1_rating : recipe.user2_rating,
        partnerRating: isUser1 ? recipe.user2_rating : recipe.user1_rating,
        currentUserComment: isUser1 ? recipe.user1_comment : recipe.user2_comment,
        partnerComment: isUser1 ? recipe.user2_comment : recipe.user1_comment,
        hasCurrentUserRated: isUser1 ? recipe.user1_rating !== null : recipe.user2_rating !== null,
        hasPartnerRated: isUser1 ? recipe.user2_rating !== null : recipe.user1_rating !== null,
        isCreatedByCurrentUser: recipe.created_by_user_id === userId
      };
    });

    res.render('recipes/index', {
      csrfToken: req.csrfToken(),
      currentUser: req.session.user,
      currentPath: req.path,
      recipes: recipesWithRatings,
      couple
    });
  } catch (error) {
    console.error('Erro ao carregar receitas:', error);
    res.status(500).render('errors/generic', {
      csrfToken: req.csrfToken(),
      currentUser: req.session.user,
      currentPath: req.path,
      error: { message: 'Erro ao carregar receitas' }
    });
  }
});

// POST /recipes - Criar nova receita
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const db = getDb();
    const userId = req.session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const couple = getUserCouple(userId);
    if (!couple) {
      return res.status(400).json({ error: 'Você precisa estar em um relacionamento' });
    }

    const { title, reference_link } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }

    const photoPath = req.file ? `/public/recipe-photos/${req.file.filename}` : null;

    const result = db.prepare(`
      INSERT INTO recipes (couple_id, title, photo_path, reference_link, created_by_user_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(couple.id, title.trim(), photoPath, reference_link?.trim() || null, userId);

    res.json({ success: true, recipeId: result.lastInsertRowid });
  } catch (error) {
    console.error('Erro ao criar receita:', error);
    res.status(500).json({ error: 'Erro ao criar receita' });
  }
});

// PUT /recipes/:id - Atualizar receita (título, foto, link)
router.put('/:id', upload.single('photo'), async (req, res) => {
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

    // Verificar se a receita pertence ao casal
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND couple_id = ?').get(id, couple.id);
    if (!recipe) {
      return res.status(404).json({ error: 'Receita não encontrada' });
    }

    const { title, reference_link } = req.body;
    let photoPath = recipe.photo_path;

    // Se uma nova foto foi enviada (SUBSTITUI a foto original)
    if (req.file) {
      // Deletar foto antiga se existir
      if (recipe.photo_path) {
        const oldPath = path.join(__dirname, '../../public', recipe.photo_path);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      photoPath = `/public/recipe-photos/${req.file.filename}`;
      
      // Reset crop metadata quando foto nova é carregada
      db.prepare(`
        UPDATE recipes 
        SET title = ?, photo_path = ?, reference_link = ?, 
            crop_x = 0, crop_y = 0, crop_scale = 1,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(title?.trim() || recipe.title, photoPath, reference_link?.trim() || null, id);
    } else {
      // Apenas atualizar título e link (mantém foto e crop)
      db.prepare(`
        UPDATE recipes 
        SET title = ?, reference_link = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(title?.trim() || recipe.title, reference_link?.trim() || null, id);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar receita:', error);
    res.status(500).json({ error: 'Erro ao atualizar receita' });
  }
});

// PUT /recipes/:id/crop - Atualizar metadados do crop (não gera nova imagem)
router.put('/:id/crop', async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { crop_x, crop_y, crop_scale } = req.body;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const couple = getUserCouple(userId);
    if (!couple) {
      return res.status(400).json({ error: 'Você precisa estar em um relacionamento' });
    }

    // Verificar se a receita pertence ao casal
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND couple_id = ?').get(id, couple.id);
    if (!recipe) {
      return res.status(404).json({ error: 'Receita não encontrada' });
    }

    // Salvar metadados do crop
    db.prepare(`
      UPDATE recipes 
      SET crop_x = ?, crop_y = ?, crop_scale = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(crop_x || 0, crop_y || 0, crop_scale || 1, id);

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao salvar crop:', error);
    res.status(500).json({ error: 'Erro ao salvar crop' });
  }
});

// PUT /recipes/:id/rating - Avaliar receita
router.put('/:id/rating', async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { rating } = req.body;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const couple = getUserCouple(userId);
    if (!couple) {
      return res.status(400).json({ error: 'Você precisa estar em um relacionamento' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating deve ser entre 1 e 5' });
    }

    // Verificar se a receita pertence ao casal
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND couple_id = ?').get(id, couple.id);
    if (!recipe) {
      return res.status(404).json({ error: 'Receita não encontrada' });
    }

    // Determinar qual coluna atualizar
    const isUser1 = userId === couple.partner1_id;
    const column = isUser1 ? 'user1_rating' : 'user2_rating';

    db.prepare(`
      UPDATE recipes 
      SET ${column} = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(rating, id);

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao avaliar receita:', error);
    res.status(500).json({ error: 'Erro ao avaliar receita' });
  }
});

// PUT /recipes/:id/comment - Atualizar comentário
router.put('/:id/comment', async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const couple = getUserCouple(userId);
    if (!couple) {
      return res.status(400).json({ error: 'Você precisa estar em um relacionamento' });
    }

    // Verificar se a receita pertence ao casal
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND couple_id = ?').get(id, couple.id);
    if (!recipe) {
      return res.status(404).json({ error: 'Receita não encontrada' });
    }

    // Determinar qual coluna atualizar
    const isUser1 = userId === couple.partner1_id;
    const column = isUser1 ? 'user1_comment' : 'user2_comment';

    db.prepare(`
      UPDATE recipes 
      SET ${column} = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(comment?.trim() || null, id);

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar comentário:', error);
    res.status(500).json({ error: 'Erro ao atualizar comentário' });
  }
});

// DELETE /recipes/:id - Deletar receita
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

    // Verificar se a receita pertence ao casal
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND couple_id = ?').get(id, couple.id);
    if (!recipe) {
      return res.status(404).json({ error: 'Receita não encontrada' });
    }

    // Deletar foto se existir
    if (recipe.photo_path) {
      const photoPath = path.join(__dirname, '../../public', recipe.photo_path);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }

    db.prepare('DELETE FROM recipes WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar receita:', error);
    res.status(500).json({ error: 'Erro ao deletar receita' });
  }
});

export default router;
