const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
    const coupleId = req.user?.coupleId || 'unknown';
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
    const coupleId = req.user?.coupleId;
    if (!coupleId) {
      return res.status(400).render('errors/generic', {
        csrfToken: req.csrfToken(),
        currentUser: req.user,
        currentPath: req.path,
        message: 'Você precisa estar em um relacionamento para ver receitas.'
      });
    }

    // Buscar informações do casal
    const couple = db.prepare(`
      SELECT 
        c.*,
        u1.display_name as partner1_name,
        u2.display_name as partner2_name
      FROM couples c
      LEFT JOIN users u1 ON c.partner1_id = u1.id
      LEFT JOIN users u2 ON c.partner2_id = u2.id
      WHERE c.id = ?
    `).get(coupleId);

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
      const isUser1 = req.user.id === couple.partner1_id;
      return {
        ...recipe,
        currentUserRating: isUser1 ? recipe.user1_rating : recipe.user2_rating,
        partnerRating: isUser1 ? recipe.user2_rating : recipe.user1_rating,
        currentUserComment: isUser1 ? recipe.user1_comment : recipe.user2_comment,
        partnerComment: isUser1 ? recipe.user2_comment : recipe.user1_comment,
        hasCurrentUserRated: isUser1 ? recipe.user1_rating !== null : recipe.user2_rating !== null,
        hasPartnerRated: isUser1 ? recipe.user2_rating !== null : recipe.user1_rating !== null,
        isCreatedByCurrentUser: recipe.created_by_user_id === req.user.id
      };
    });

    res.render('recipes/index', {
      csrfToken: req.csrfToken(),
      currentUser: req.user,
      currentPath: req.path,
      recipes: recipesWithRatings,
      couple
    });
  } catch (error) {
    console.error('Erro ao carregar receitas:', error);
    res.status(500).render('errors/generic', {
      csrfToken: req.csrfToken(),
      currentUser: req.user,
      currentPath: req.path,
      message: 'Erro ao carregar receitas'
    });
  }
});

// POST /recipes - Criar nova receita
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const coupleId = req.user?.coupleId;
    if (!coupleId) {
      return res.status(400).json({ error: 'Você precisa estar em um relacionamento' });
    }

    const { title, reference_link } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }

    const photoPath = req.file ? `/recipe-photos/${req.file.filename}` : null;

    const result = db.prepare(`
      INSERT INTO recipes (couple_id, title, photo_path, reference_link, created_by_user_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(coupleId, title.trim(), photoPath, reference_link?.trim() || null, req.user.id);

    res.json({ success: true, recipeId: result.lastInsertRowid });
  } catch (error) {
    console.error('Erro ao criar receita:', error);
    res.status(500).json({ error: 'Erro ao criar receita' });
  }
});

// PUT /recipes/:id - Atualizar receita (título, foto, link)
router.put('/:id', upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const coupleId = req.user?.coupleId;

    // Verificar se a receita pertence ao casal
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND couple_id = ?').get(id, coupleId);
    if (!recipe) {
      return res.status(404).json({ error: 'Receita não encontrada' });
    }

    const { title, reference_link } = req.body;
    let photoPath = recipe.photo_path;

    // Se uma nova foto foi enviada
    if (req.file) {
      // Deletar foto antiga se existir
      if (recipe.photo_path) {
        const oldPath = path.join(__dirname, '../../public', recipe.photo_path);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      photoPath = `/recipe-photos/${req.file.filename}`;
    }

    db.prepare(`
      UPDATE recipes 
      SET title = ?, photo_path = ?, reference_link = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(title?.trim() || recipe.title, photoPath, reference_link?.trim() || null, id);

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar receita:', error);
    res.status(500).json({ error: 'Erro ao atualizar receita' });
  }
});

// PUT /recipes/:id/rating - Avaliar receita
router.put('/:id/rating', async (req, res) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    const coupleId = req.user?.coupleId;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating deve ser entre 1 e 5' });
    }

    // Verificar se a receita pertence ao casal
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND couple_id = ?').get(id, coupleId);
    if (!recipe) {
      return res.status(404).json({ error: 'Receita não encontrada' });
    }

    // Buscar informações do casal para determinar qual coluna atualizar
    const couple = db.prepare('SELECT * FROM couples WHERE id = ?').get(coupleId);
    const isUser1 = req.user.id === couple.partner1_id;

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
    const { id } = req.params;
    const { comment } = req.body;
    const coupleId = req.user?.coupleId;

    // Verificar se a receita pertence ao casal
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND couple_id = ?').get(id, coupleId);
    if (!recipe) {
      return res.status(404).json({ error: 'Receita não encontrada' });
    }

    // Buscar informações do casal para determinar qual coluna atualizar
    const couple = db.prepare('SELECT * FROM couples WHERE id = ?').get(coupleId);
    const isUser1 = req.user.id === couple.partner1_id;

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
    const { id } = req.params;
    const coupleId = req.user?.coupleId;

    // Verificar se a receita pertence ao casal
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ? AND couple_id = ?').get(id, coupleId);
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

module.exports = router;
