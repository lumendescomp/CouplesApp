import express from 'express';
import { getDb } from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

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
      
      // Reset crop metadata quando foto nova é carregada (centralizar imagem)
      db.prepare(`
        UPDATE recipes 
        SET title = ?, photo_path = ?, reference_link = ?, 
            crop_x = 50, crop_y = 50,
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

// PUT /recipes/:id/crop - Processar crop da imagem (gera nova imagem cropada)
router.put('/:id/crop', async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { crop_x, crop_y } = req.body;
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

    if (!recipe.photo_path) {
      return res.status(400).json({ error: 'Receita não tem foto' });
    }

    // Determinar qual é a foto ORIGINAL
    // photo_path vem como "/public/recipe-photos/couple1_XXX.jpg"
    // Remover "/public" do início para evitar duplicação
    const photoPathClean = recipe.photo_path.replace(/^\/public\//, '');
    const currentPhotoPath = path.join(__dirname, '../../public', photoPathClean);
    const ext = path.extname(recipe.photo_path);
    const dir = path.dirname(currentPhotoPath);
    const baseName = path.basename(recipe.photo_path, ext);
    
    // Nome da foto original (com sufixo _original)
    const originalFileName = baseName.replace('_cropped', '') + '_original' + ext;
    const originalPath = path.join(dir, originalFileName);
    
    // Se não existe arquivo "_original", a foto atual É a original
    let sourcePhotoPath;
    if (fs.existsSync(originalPath)) {
      sourcePhotoPath = originalPath;
    } else {
      // Primeira vez cropando - salvar cópia da original
      fs.copyFileSync(currentPhotoPath, originalPath);
      sourcePhotoPath = originalPath;
    }
    
    if (!fs.existsSync(sourcePhotoPath)) {
      return res.status(404).json({ error: 'Arquivo de foto não encontrado' });
    }

    // Definir tamanho do card (aspect ratio 4:3) - mesmo tamanho do card no frontend
    const CARD_WIDTH = 385;
    const CARD_HEIGHT = 280;

    // Ler metadados da imagem original
    const metadata = await sharp(sourcePhotoPath).metadata();
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;

    // Calcular a área visível da imagem baseado em object-position
    // Simulando o comportamento de object-fit: cover com object-position
    const containerRatio = CARD_WIDTH / CARD_HEIGHT; // 4:3 ≈ 1.375
    const imageRatio = imgWidth / imgHeight;
    
    let visibleWidth, visibleHeight;
    
    if (imageRatio > containerRatio) {
      // Imagem mais larga - height preenche 100%, width é cortada
      visibleHeight = imgHeight;
      visibleWidth = imgHeight * containerRatio;
    } else {
      // Imagem mais alta - width preenche 100%, height é cortada
      visibleWidth = imgWidth;
      visibleHeight = imgWidth / containerRatio;
    }
    
    // Calcular offset baseado em crop_x e crop_y (porcentagem 0-100)
    // crop_x/y funcionam como object-position: 0% = esquerda/topo, 100% = direita/fundo
    const maxOffsetX = Math.max(0, imgWidth - visibleWidth);
    const maxOffsetY = Math.max(0, imgHeight - visibleHeight);
    
    const offsetX = Math.round((crop_x / 100) * maxOffsetX);
    const offsetY = Math.round((crop_y / 100) * maxOffsetY);
    
    console.log('📸 Processando crop:', {
      original: { width: imgWidth, height: imgHeight, ratio: imageRatio.toFixed(2) },
      visible: { width: Math.round(visibleWidth), height: Math.round(visibleHeight) },
      position: { x: crop_x + '%', y: crop_y + '%' },
      offset: { x: offsetX, y: offsetY },
      output: { width: CARD_WIDTH, height: CARD_HEIGHT }
    });

    // Nome do arquivo cropado (sobrescreve o anterior se existir)
    const croppedFileName = baseName.replace('_cropped', '').replace('_original', '') + '_cropped' + ext;
    const croppedPath = path.join(dir, croppedFileName);
    const croppedRelativePath = `/public/recipe-photos/${croppedFileName}`;

    // Processar imagem com Sharp:
    // 1. Extrair a área visível da imagem original
    // 2. Redimensionar para o tamanho exato do card
    await sharp(sourcePhotoPath)
      .extract({
        left: Math.max(0, Math.min(Math.round(offsetX), imgWidth - Math.round(visibleWidth))),
        top: Math.max(0, Math.min(Math.round(offsetY), imgHeight - Math.round(visibleHeight))),
        width: Math.min(Math.round(visibleWidth), imgWidth),
        height: Math.min(Math.round(visibleHeight), imgHeight)
      })
      .resize(CARD_WIDTH, CARD_HEIGHT, {
        fit: 'cover',
        position: 'centre'
      })
      .jpeg({ quality: 92 })
      .toFile(croppedPath);

    console.log('✅ Imagem cropada salva:', croppedRelativePath);

    // Atualizar banco de dados com caminho da imagem cropada
    db.prepare(`
      UPDATE recipes 
      SET photo_path = ?, crop_x = ?, crop_y = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(croppedRelativePath, crop_x || 50, crop_y || 50, id);

    res.json({ success: true, photo_path: croppedRelativePath });
  } catch (error) {
    console.error('❌ Erro ao processar crop:', error);
    res.status(500).json({ error: 'Erro ao processar crop: ' + error.message });
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
