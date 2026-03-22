require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middlewares ───────────────────────────────────────────
app.use(cors({ origin: '*' })); // Em produção, restrinja ao domínio do front
app.use(express.json());

// ─── MongoDB Connection ────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => { console.error('❌ Erro MongoDB:', err); process.exit(1); });

// ═══════════════════════════════════════════════════════════
//  SCHEMAS / MODELS
// ═══════════════════════════════════════════════════════════

// ── Member ──────────────────────────────────────────────────
const MemberSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  color:    { type: String, required: true },
  isAdmin:  { type: Boolean, default: false },
  passHash: { type: String, default: null }, // apenas admin
}, { timestamps: true });

const Member = mongoose.model('Member', MemberSchema);

// ── Activity ─────────────────────────────────────────────────
const CommentSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  text:     { type: String, required: true },
  date:     { type: Date, default: Date.now },
});

const ActivitySchema = new mongoose.Schema({
  title:     { type: String, required: true, trim: true },
  desc:      { type: String, default: '' },
  days:      { type: [Number], required: true }, // 0=Seg … 6=Dom, array para múltiplos dias
  type:      { type: String, enum: ['single', 'recurring'], required: true },
  date:      { type: String, default: null },     // YYYY-MM-DD — apenas para tipo single
  vigencia:  { type: String, default: null },     // YYYY-MM-DD — apenas para tipo recurring
  timeStart: { type: String, default: '' },
  timeEnd:   { type: String, default: '' },
  tags:      { type: [String], default: [] },
  memberIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Member', default: [] },
  color:     { type: String, default: 'yellow' },
  comments:  { type: [CommentSchema], default: [] },
  done:      { type: Boolean, default: false },
  archived:  { type: Boolean, default: false },
}, { timestamps: true });

const Activity = mongoose.model('Activity', ActivitySchema);

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════
function handleError(res, err, msg = 'Erro interno') {
  console.error(msg, err);
  res.status(500).json({ error: msg, detail: err.message });
}

// ═══════════════════════════════════════════════════════════
//  ROUTES — MEMBERS
// ═══════════════════════════════════════════════════════════

// GET /api/members — listar todos
app.get('/api/members', async (req, res) => {
  try {
    const members = await Member.find().select('-passHash').sort({ createdAt: 1 });
    res.json(members);
  } catch (err) { handleError(res, err, 'Erro ao listar membros'); }
});

// POST /api/members/setup — criar admin (só funciona se não existir nenhum membro)
app.post('/api/members/setup', async (req, res) => {
  try {
    const count = await Member.countDocuments();
    if (count > 0) return res.status(403).json({ error: 'Setup já realizado.' });

    const { name, color, password } = req.body;
    if (!name || !password) return res.status(400).json({ error: 'Nome e senha obrigatórios.' });
    if (password.length < 4) return res.status(400).json({ error: 'Senha mínima de 4 caracteres.' });

    const passHash = await bcrypt.hash(password, 10);
    const admin = await Member.create({ name, color, isAdmin: true, passHash });
    const { passHash: _, ...safe } = admin.toObject();
    res.status(201).json(safe);
  } catch (err) { handleError(res, err, 'Erro no setup'); }
});

// POST /api/members — criar membro (requer senha admin)
app.post('/api/members', async (req, res) => {
  try {
    const { name, color, adminPassword } = req.body;
    if (!name || !adminPassword) return res.status(400).json({ error: 'Nome e senha do admin obrigatórios.' });

    const admin = await Member.findOne({ isAdmin: true });
    if (!admin) return res.status(403).json({ error: 'Admin não encontrado.' });

    const valid = await bcrypt.compare(adminPassword, admin.passHash);
    if (!valid) return res.status(401).json({ error: 'Senha incorreta.' });

    const member = await Member.create({ name, color, isAdmin: false });
    const { passHash: _, ...safe } = member.toObject();
    res.status(201).json(safe);
  } catch (err) { handleError(res, err, 'Erro ao criar membro'); }
});

// DELETE /api/members/:id — remover membro (requer senha admin)
app.delete('/api/members/:id', async (req, res) => {
  try {
    const { adminPassword } = req.body;
    const admin = await Member.findOne({ isAdmin: true });
    if (!admin) return res.status(403).json({ error: 'Admin não encontrado.' });

    const valid = await bcrypt.compare(adminPassword, admin.passHash);
    if (!valid) return res.status(401).json({ error: 'Senha incorreta.' });

    const target = await Member.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Membro não encontrado.' });
    if (target.isAdmin) return res.status(403).json({ error: 'Não é possível remover o admin.' });

    await Member.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { handleError(res, err, 'Erro ao remover membro'); }
});

// POST /api/members/login — verificar senha do admin
app.post('/api/members/login', async (req, res) => {
  try {
    const { memberId, password } = req.body;
    const member = await Member.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Membro não encontrado.' });
    if (!member.isAdmin) return res.status(400).json({ error: 'Membro não é admin.' });

    const valid = await bcrypt.compare(password, member.passHash);
    if (!valid) return res.status(401).json({ error: 'Senha incorreta.' });

    const { passHash: _, ...safe } = member.toObject();
    res.json({ ok: true, member: safe });
  } catch (err) { handleError(res, err, 'Erro no login'); }
});

// ═══════════════════════════════════════════════════════════
//  ROUTES — ACTIVITIES
// ═══════════════════════════════════════════════════════════

// GET /api/activities — listar (com filtros opcionais)
// Query params: memberId, type, periodFrom, periodTo, tag, archived
app.get('/api/activities', async (req, res) => {
  try {
    const { memberId, type, periodFrom, periodTo, tag, archived } = req.query;
    const query = {};

    // Visibilidade: atividades sem membros (globais) ou que incluam o membro
    if (memberId) {
      query.$or = [
        { memberIds: { $size: 0 } },
        { memberIds: mongoose.Types.ObjectId.isValid(memberId) ? new mongoose.Types.ObjectId(memberId) : memberId }
      ];
    }

    if (type) query.type = type;
    if (tag) query.tags = tag;
    query.archived = archived === 'true' ? true : { $ne: true };

    // Filtro de período
    if (periodFrom || periodTo) {
      const dateFilter = {};
      if (periodFrom) dateFilter.$gte = periodFrom;
      if (periodTo)   dateFilter.$lte = periodTo;
      query.$or = query.$or || [];
      // single: filtra por date; recurring: filtra por vigencia
      query.$and = [
        {
          $or: [
            { type: 'single',    date:     dateFilter },
            { type: 'recurring', vigencia: dateFilter },
          ]
        },
        ...(query.$and || [])
      ];
      delete query.type; // já está no $and acima se necessário
    }

    const activities = await Activity.find(query)
      .populate('memberIds', '-passHash')
      .sort({ createdAt: -1 });

    // Auto-arquivar recorrentes vencidas
    const today = new Date().toISOString().split('T')[0];
    const toArchive = activities.filter(a => a.type === 'recurring' && a.vigencia && a.vigencia < today && !a.archived);
    if (toArchive.length > 0) {
      await Activity.updateMany(
        { _id: { $in: toArchive.map(a => a._id) } },
        { $set: { archived: true } }
      );
      toArchive.forEach(a => a.archived = true);
    }

    res.json(activities);
  } catch (err) { handleError(res, err, 'Erro ao listar atividades'); }
});

// GET /api/activities/archive — listar arquivo morto
app.get('/api/activities/archive', async (req, res) => {
  try {
    const { memberId } = req.query;
    const query = { archived: true };
    if (memberId && mongoose.Types.ObjectId.isValid(memberId)) {
      query.$or = [
        { memberIds: { $size: 0 } },
        { memberIds: new mongoose.Types.ObjectId(memberId) }
      ];
    }
    const activities = await Activity.find(query)
      .populate('memberIds', '-passHash')
      .sort({ vigencia: -1 });
    res.json(activities);
  } catch (err) { handleError(res, err, 'Erro ao listar arquivo'); }
});

// POST /api/activities — criar (um documento independente por dia selecionado)
app.post('/api/activities', async (req, res) => {
  try {
    const { title, desc, days, type, date, vigencia, timeStart, timeEnd, tags, memberIds, color } = req.body;
    if (!title) return res.status(400).json({ error: 'Título obrigatório.' });
    if (!days || days.length === 0) return res.status(400).json({ error: 'Selecione ao menos um dia.' });
    if (type === 'single' && !date) return res.status(400).json({ error: 'Data obrigatória para atividade única.' });
    if (type === 'recurring' && !vigencia) return res.status(400).json({ error: 'Vigência obrigatória para atividade recorrente.' });

    // Cria um documento separado para cada dia marcado
    const created = await Promise.all(
      days.map(day =>
        Activity.create({
          title, desc,
          days: [day],   // cada doc tem apenas o seu próprio dia
          type, date, vigencia,
          timeStart, timeEnd,
          tags: tags || [],
          memberIds: memberIds || [],
          color: color || 'yellow'
        })
      )
    );

    // Popula e retorna todos os documentos criados
    const populated = await Promise.all(
      created.map(a => a.populate('memberIds', '-passHash'))
    );
    res.status(201).json(populated);
  } catch (err) { handleError(res, err, 'Erro ao criar atividade'); }
});

// PUT /api/activities/:id — atualizar
app.put('/api/activities/:id', async (req, res) => {
  try {
    // Apenas campos editáveis pelo usuário — nunca sobrescreve comments, done, archived
    const { title, desc, days, type, date, vigencia, timeStart, timeEnd, tags, memberIds, color } = req.body;

    const existing = await Activity.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Atividade não encontrada.' });

    // Preserva a data original se o novo valor for null/vazio e a atividade for single
    const resolvedDate = (type === 'single')
      ? (date || existing.date || null)
      : null;

    const updates = {
      title:     title     ?? existing.title,
      desc:      desc      ?? existing.desc,
      days:      days      ?? existing.days,
      type:      type      ?? existing.type,
      date:      resolvedDate,
      vigencia:  type === 'recurring' ? (vigencia || existing.vigencia) : null,
      timeStart: timeStart !== undefined ? timeStart : existing.timeStart,
      timeEnd:   timeEnd   !== undefined ? timeEnd   : existing.timeEnd,
      tags:      tags      ?? existing.tags,
      memberIds: memberIds ?? existing.memberIds,
      color:     color     ?? existing.color,
      // Preserva explicitamente campos que não devem ser alterados pelo form
      done:      existing.done,
      archived:  existing.archived,
      comments:  existing.comments,
    };

    const activity = await Activity.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('memberIds', '-passHash');

    if (!activity) return res.status(404).json({ error: 'Atividade não encontrada.' });
    res.json(activity);
  } catch (err) { handleError(res, err, 'Erro ao atualizar atividade'); }
});

// PATCH /api/activities/:id/done — toggle concluído
app.patch('/api/activities/:id/done', async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Atividade não encontrada.' });
    activity.done = !activity.done;
    await activity.save();
    res.json({ ok: true, done: activity.done });
  } catch (err) { handleError(res, err, 'Erro ao atualizar status'); }
});

// POST /api/activities/:id/comments — adicionar comentário
app.post('/api/activities/:id/comments', async (req, res) => {
  try {
    const { authorId, text } = req.body;
    if (!text) return res.status(400).json({ error: 'Texto obrigatório.' });

    const activity = await Activity.findById(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Atividade não encontrada.' });

    activity.comments.push({ authorId, text });
    await activity.save();
    const populated = await activity.populate('memberIds', '-passHash');
    res.json(populated.comments[populated.comments.length - 1]);
  } catch (err) { handleError(res, err, 'Erro ao adicionar comentário'); }
});

// DELETE /api/activities/:id — excluir
app.delete('/api/activities/:id', async (req, res) => {
  try {
    const activity = await Activity.findByIdAndDelete(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Atividade não encontrada.' });
    res.json({ ok: true });
  } catch (err) { handleError(res, err, 'Erro ao excluir atividade'); }
});

// ─── Health check ──────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));

// ─── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 FamíliaKanban API rodando em http://localhost:${PORT}`);
});
