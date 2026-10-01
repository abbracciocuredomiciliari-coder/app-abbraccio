import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ShopProduct from '../models/ShopProduct';
import ShopReview from '../models/ShopReview';
import ShopOrder from '../models/ShopOrder';
import ShopAdmin from '../models/ShopAdmin';
import ShopConfig from '../models/ShopConfig';
import { inviaEmail } from '../utils/email';

const router = Router();

// ─── Upload immagini prodotti (storage locale pubblico /shop-images) ──────────
const SHOP_IMG_DIR = path.join(process.cwd(), 'uploads', 'shop');
if (!fs.existsSync(SHOP_IMG_DIR)) fs.mkdirSync(SHOP_IMG_DIR, { recursive: true });

const shopStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, SHOP_IMG_DIR),
  filename: (_req, file, cb) => {
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname).toLowerCase()}`;
    cb(null, safe);
  },
});
const uploadShopImg = multer({
  storage: shopStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Solo immagini consentite'));
  },
});

// ─── Auth shop admin (JWT separato dal gestionale) ────────────────────────────
const jwtSecret = process.env.JWT_SECRET as string;

const authenticateShopAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) return res.status(401).json({ message: 'Login shop richiesto' });
  try {
    const payload = jwt.verify(token, jwtSecret) as { scope?: string; shopAdminId?: string };
    if (payload.scope !== 'shop' || !payload.shopAdminId) {
      return res.status(403).json({ message: 'Permesso negato: area shop' });
    }
    (req as any).shopAdminId = payload.shopAdminId;
    next();
  } catch {
    return res.status(401).json({ message: 'Sessione shop scaduta — rifare login' });
  }
};

// ─── Seed admin shop da variabili d'ambiente (SHOP_ADMIN_EMAIL / SHOP_ADMIN_PASSWORD) ──
export async function seedShopAdmin() {
  try {
    const count = await ShopAdmin.countDocuments();
    const email = process.env.SHOP_ADMIN_EMAIL?.toLowerCase().trim();
    const password = process.env.SHOP_ADMIN_PASSWORD;
    if (count > 0) return;
    if (!email || !password) {
      console.warn('⚠️ Nessun ShopAdmin presente. Imposta SHOP_ADMIN_EMAIL e SHOP_ADMIN_PASSWORD nel .env per crearlo.');
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await ShopAdmin.create({ email, passwordHash, nome: 'Shop Admin' });
    console.log(`✅ ShopAdmin creato: ${email}`);
  } catch (err) {
    console.error('❌ Seed ShopAdmin fallito:', err);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// AUTH SHOP ADMIN
// ════════════════════════════════════════════════════════════════════════════

router.post('/admin/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Email e password richieste' });
  try {
    const admin = await ShopAdmin.findOne({ email: String(email).toLowerCase().trim() });
    if (!admin) return res.status(401).json({ message: 'Credenziali non valide' });
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Credenziali non valide' });
    const token = jwt.sign({ scope: 'shop', shopAdminId: admin._id.toString() }, jwtSecret, { expiresIn: '12h' });
    return res.json({ token, nome: admin.nome, email: admin.email });
  } catch (err) {
    return res.status(500).json({ message: 'Errore login', error: String(err) });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ENDPOINT PUBBLICI (sito-abbraccio)
// ════════════════════════════════════════════════════════════════════════════

// Lista prodotti attivi
router.get('/products', async (req: Request, res: Response) => {
  try {
    const filter: any = { attivo: true };
    if (req.query.categoria) filter.categoria = req.query.categoria;
    const products = await ShopProduct.find(filter).sort({ ordine: 1, createdAt: -1 });
    // Allega media recensioni
    const agg = await ShopReview.aggregate([
      { $match: { approvato: true } },
      { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const map: Record<string, { avg: number; count: number }> = {};
    agg.forEach(a => { map[a._id.toString()] = { avg: a.avg, count: a.count }; });
    const out = products.map(p => ({
      ...p.toObject(),
      rating: map[p._id.toString()]?.avg ? Math.round(map[p._id.toString()].avg * 10) / 10 : null,
      reviewsCount: map[p._id.toString()]?.count || 0,
    }));
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ message: 'Errore caricamento prodotti', error: String(err) });
  }
});

// Singolo prodotto + recensioni approvate
router.get('/products/:id', async (req: Request, res: Response) => {
  try {
    const p = await ShopProduct.findById(req.params.id);
    if (!p || !p.attivo) return res.status(404).json({ message: 'Prodotto non trovato' });
    const reviews = await ShopReview.find({ product: p._id, approvato: true }).sort({ createdAt: -1 });
    return res.json({ product: p, reviews });
  } catch (err) {
    return res.status(500).json({ message: 'Errore prodotto', error: String(err) });
  }
});

// Recensione pubblica (resta in attesa di approvazione)
router.post('/products/:id/reviews', async (req: Request, res: Response) => {
  try {
    const p = await ShopProduct.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Prodotto non trovato' });
    const { nome, rating, testo } = req.body || {};
    const r = Number(rating);
    if (!nome?.trim() || !(r >= 1 && r <= 5)) {
      return res.status(400).json({ message: 'Nome e valutazione 1-5 obbligatori' });
    }
    await ShopReview.create({ product: p._id, nome: nome.trim(), rating: r, testo: testo?.trim() || '' });
    return res.status(201).json({ message: 'Grazie! La recensione sarà pubblicata dopo moderazione.' });
  } catch (err) {
    return res.status(500).json({ message: 'Errore recensione', error: String(err) });
  }
});

// Config pubblica (link PayPal)
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const cfg = await ShopConfig.findOne().lean();
    return res.json({
      paypalLink: cfg?.paypalLink || '',
      linkCarta: cfg?.linkCarta || '',
      iban: cfg?.iban || '',
      noteCheckout: cfg?.noteCheckout || '',
      offerte: cfg?.offerte || [],
      telefonoAssistenza: cfg?.telefonoAssistenza || '',
      whatsappAssistenza: cfg?.whatsappAssistenza || '',
      emailAssistenza: cfg?.emailAssistenza || '',
    });
  } catch (err) {
    return res.status(500).json({ message: 'Errore config', error: String(err) });
  }
});

// Ordine acquisto (carrello)
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const { items, cliente, metodoPagamento } = req.body || {};
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Carrello vuoto' });
    if (!cliente?.nome || !cliente?.email || !cliente?.telefono) {
      return res.status(400).json({ message: 'Nome, email e telefono obbligatori' });
    }
    if (!['paypal', 'carta', 'bonifico'].includes(metodoPagamento)) {
      return res.status(400).json({ message: 'Seleziona un metodo di pagamento' });
    }
    // Ricalcola prezzi lato server (mai fidarsi del client)
    const ids = items.map((i: any) => i.productId).filter(Boolean);
    const prods = await ShopProduct.find({ _id: { $in: ids }, attivo: true, categoria: { $in: ['vendita', 'noleggio'] } });
    const pmap = new Map(prods.map(p => [p._id.toString(), p]));
    let totale = 0;
    let hasNoleggio = false;
    const finalItems: any[] = [];
    const TARIFFA_LABEL: Record<string, string> = { giorno: 'giorno', settimana: 'settimana', mese: 'mese' };
    for (const i of items) {
      const p = pmap.get(String(i.productId));
      if (!p) return res.status(400).json({ message: `Prodotto non valido: ${i.nome || i.productId}` });
      if (!p.disponibile) return res.status(400).json({ message: `"${p.nome}" non è disponibile` });
      const qty = Math.max(1, Math.min(50, Number(i.qty) || 1));
      let prezzoEff: number;
      let tariffa = '';
      if (p.categoria === 'noleggio') {
        hasNoleggio = true;
        tariffa = TARIFFA_LABEL[String(i.tariffa)] || '';
        const n = p.prezzoNoleggio || {};
        const tariffaEff = tariffa && n[tariffa as 'giorno'|'settimana'|'mese'] ? tariffa
          : (n.mese ? 'mese' : n.settimana ? 'settimana' : 'giorno');
        tariffa = tariffaEff;
        prezzoEff = Number((n as any)[tariffaEff]) || 0;
        finalItems.push({ product: p._id, nome: `${p.nome} (noleggio/${tariffaEff})`, prezzo: prezzoEff, qty, tariffa: tariffaEff });
      } else {
        prezzoEff = (p.inOfferta && (p.prezzoScontato || 0) > 0) ? p.prezzoScontato! : (p.prezzo || 0);
        finalItems.push({ product: p._id, nome: p.nome, prezzo: prezzoEff, qty });
      }
      totale += prezzoEff * qty;
    }
    const order = await ShopOrder.create({
      tipo: hasNoleggio ? 'noleggio' : 'acquisto',
      metodoPagamento,
      items: finalItems,
      cliente: {
        nome: cliente.nome.trim(), email: cliente.email.trim().toLowerCase(),
        telefono: cliente.telefono.trim(), indirizzo: cliente.indirizzo?.trim() || '',
        note: cliente.note?.trim() || '',
      },
      totale,
    });
    const adminEmail = process.env.ADMIN_EMAIL || 'abbracciocuredomiciliari@gmail.com';
    inviaEmail({
      to: adminEmail,
      subject: `🛒 Nuovo ordine Shop #${order._id.toString().slice(-6)} — €${totale.toFixed(2)}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
        <h2 style="color:#1e4d8c;">🛒 Nuovo ordine dallo Shop</h2>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;width:140px;">Cliente:</td><td style="padding:8px;">${cliente.nome}</td></tr>
          <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Email:</td><td style="padding:8px;">${cliente.email}</td></tr>
          <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Telefono:</td><td style="padding:8px;">${cliente.telefono}</td></tr>
          ${cliente.indirizzo ? `<tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Indirizzo:</td><td style="padding:8px;">${cliente.indirizzo}</td></tr>` : ''}
          <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Pagamento:</td><td style="padding:8px;"><strong>${metodoPagamento === 'paypal' ? 'PayPal' : metodoPagamento === 'carta' ? 'Carta di credito' : 'Bonifico bancario'}</strong></td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;">
          <tr style="background:#f8fafc;"><th style="padding:8px;text-align:left;">Prodotto</th><th style="padding:8px;">Qtà</th><th style="padding:8px;text-align:right;">Prezzo</th></tr>
          ${finalItems.map(it => `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${it.nome}</td><td style="padding:8px;text-align:center;border-bottom:1px solid #eee;">${it.qty}</td><td style="padding:8px;text-align:right;border-bottom:1px solid #eee;">€${(it.prezzo * it.qty).toFixed(2)}</td></tr>`).join('')}
          <tr><td colspan="2" style="padding:10px;font-weight:bold;">TOTALE</td><td style="padding:10px;text-align:right;font-weight:bold;color:#1e4d8c;">€${totale.toFixed(2)}</td></tr>
        </table>
        ${cliente.note ? `<p style="background:#fffbeb;padding:10px;border-radius:6px;border-left:3px solid #f59e0b;"><strong>Note:</strong> ${cliente.note}</p>` : ''}
        <p style="margin-top:16px;font-size:12px;color:#888;">Gestisci l'ordine da shop-admin.html → tab Ordini</p>
      </div>`,
    }).catch(() => {});
    return res.status(201).json({ ok: true, orderId: order._id, totale });
  } catch (err) {
    return res.status(500).json({ message: 'Errore creazione ordine', error: String(err) });
  }
});

// Richiesta noleggio o prenotazione apnea
router.post('/requests', async (req: Request, res: Response) => {
  try {
    const { productId, tipo, cliente, periodo } = req.body || {};
    if (!['noleggio', 'apnea'].includes(tipo)) return res.status(400).json({ message: 'Tipo richiesta non valido' });
    const p = await ShopProduct.findOne({ _id: productId, attivo: true });
    if (!p) return res.status(404).json({ message: 'Prodotto non trovato' });
    if (!cliente?.nome || !cliente?.email || !cliente?.telefono) {
      return res.status(400).json({ message: 'Nome, email e telefono obbligatori' });
    }
    if (tipo === 'noleggio' && (!periodo?.da || !periodo?.a)) {
      return res.status(400).json({ message: 'Periodo noleggio obbligatorio (da/a)' });
    }
    const order = await ShopOrder.create({
      tipo,
      items: [{ product: p._id, nome: p.nome, prezzo: p.prezzo || 0, qty: 1 }],
      cliente: {
        nome: cliente.nome.trim(), email: cliente.email.trim().toLowerCase(),
        telefono: cliente.telefono.trim(), indirizzo: cliente.indirizzo?.trim() || '',
        note: cliente.note?.trim() || '',
      },
      periodo: periodo ? { da: periodo.da || undefined, a: periodo.a || undefined } : undefined,
      totale: 0, // preventivo confermato dall'admin
    });
    const adminEmail = process.env.ADMIN_EMAIL || 'abbracciocuredomiciliari@gmail.com';
    const label = tipo === 'noleggio' ? '🔧 Richiesta noleggio' : '😴 Prenotazione esame apnea';
    inviaEmail({
      to: adminEmail,
      subject: `${label} — ${p.nome}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
        <h2 style="color:#1e4d8c;">${label}</h2>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;width:140px;">Prodotto:</td><td style="padding:8px;">${p.nome}</td></tr>
          <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Cliente:</td><td style="padding:8px;">${cliente.nome}</td></tr>
          <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Email:</td><td style="padding:8px;">${cliente.email}</td></tr>
          <tr><td style="padding:8px;background:#f1f5f9;font-weight:bold;">Telefono:</td><td style="padding:8px;">${cliente.telefono}</td></tr>
          ${periodo?.da ? `<tr><td style="padding:8px;background:#f8fafc;font-weight:bold;">Periodo:</td><td style="padding:8px;">${new Date(periodo.da).toLocaleDateString('it-IT')} → ${new Date(periodo.a).toLocaleDateString('it-IT')}</td></tr>` : ''}
        </table>
        ${cliente.note ? `<p style="background:#fffbeb;padding:10px;border-radius:6px;border-left:3px solid #f59e0b;"><strong>Note:</strong> ${cliente.note}</p>` : ''}
        <p style="margin-top:16px;font-size:12px;color:#888;">Gestisci la richiesta da shop-admin.html → tab Ordini</p>
      </div>`,
    }).catch(() => {});
    return res.status(201).json({ ok: true, requestId: order._id });
  } catch (err) {
    return res.status(500).json({ message: 'Errore richiesta', error: String(err) });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ENDPOINT ADMIN SHOP (protetti da authenticateShopAdmin)
// ════════════════════════════════════════════════════════════════════════════

// Prodotti — lista completa
router.get('/admin/products', authenticateShopAdmin, async (_req: Request, res: Response) => {
  const products = await ShopProduct.find().sort({ ordine: 1, createdAt: -1 });
  return res.json(products);
});

// Crea prodotto
router.post('/admin/products', authenticateShopAdmin, async (req: Request, res: Response) => {
  try {
    const { nome, descrizione, categoria, prezzo, prezzoNoleggio, cauzione, disponibile, attivo, ordine, inOfferta, prezzoScontato, tempoSpedizione, ritiroMagazzino, badge } = req.body || {};
    if (!nome?.trim() || !['vendita', 'noleggio', 'apnea'].includes(categoria)) {
      return res.status(400).json({ message: 'Nome e categoria valida obbligatori' });
    }
    const p = await ShopProduct.create({
      nome: nome.trim(), descrizione: descrizione?.trim() || '', categoria,
      prezzo: Number(prezzo) || 0,
      prezzoNoleggio: prezzoNoleggio || {},
      cauzione: Number(cauzione) || 0,
      disponibile: disponibile !== false, attivo: attivo !== false,
      ordine: Number(ordine) || 0, immagini: [],
      inOfferta: !!inOfferta,
      prezzoScontato: Number(prezzoScontato) || 0,
      tempoSpedizione: tempoSpedizione?.trim() || '',
      ritiroMagazzino: !!ritiroMagazzino,
      badge: badge?.trim() || '',
    });
    return res.status(201).json(p);
  } catch (err) {
    return res.status(500).json({ message: 'Errore creazione', error: String(err) });
  }
});

// Modifica prodotto
router.put('/admin/products/:id', authenticateShopAdmin, async (req: Request, res: Response) => {
  try {
    const p = await ShopProduct.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!p) return res.status(404).json({ message: 'Prodotto non trovato' });
    return res.json(p);
  } catch (err) {
    return res.status(500).json({ message: 'Errore aggiornamento', error: String(err) });
  }
});

// Elimina prodotto (e recensioni collegate)
router.delete('/admin/products/:id', authenticateShopAdmin, async (req: Request, res: Response) => {
  try {
    const p = await ShopProduct.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ message: 'Prodotto non trovato' });
    await ShopReview.deleteMany({ product: p._id });
    (p.immagini || []).forEach(src => {
      const f = path.join(SHOP_IMG_DIR, path.basename(src));
      if (fs.existsSync(f)) fs.unlink(f, () => {});
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: 'Errore eliminazione', error: String(err) });
  }
});

// Upload immagine prodotto
router.post('/admin/products/:id/images', authenticateShopAdmin, uploadShopImg.single('image'), async (req: Request, res: Response) => {
  try {
    const p = await ShopProduct.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Prodotto non trovato' });
    if (!req.file) return res.status(400).json({ message: 'File mancante' });
    const url = `/shop-images/${req.file.filename}`;
    p.immagini.push(url);
    await p.save();
    return res.json({ url, immagini: p.immagini });
  } catch (err) {
    return res.status(500).json({ message: 'Errore upload', error: String(err) });
  }
});

// Rimuovi immagine prodotto
router.delete('/admin/products/:id/images', authenticateShopAdmin, async (req: Request, res: Response) => {
  try {
    const p = await ShopProduct.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Prodotto non trovato' });
    const src = String(req.body.src || '');
    p.immagini = p.immagini.filter(i => i !== src);
    await p.save();
    const f = path.join(SHOP_IMG_DIR, path.basename(src));
    if (fs.existsSync(f)) fs.unlink(f, () => {});
    return res.json({ immagini: p.immagini });
  } catch (err) {
    return res.status(500).json({ message: 'Errore rimozione immagine', error: String(err) });
  }
});

// Recensioni — lista (filtro ?stato=attesa|approvate)
router.get('/admin/reviews', authenticateShopAdmin, async (req: Request, res: Response) => {
  const filter: any = {};
  if (req.query.stato === 'attesa') filter.approvato = false;
  if (req.query.stato === 'approvate') filter.approvato = true;
  const reviews = await ShopReview.find(filter).populate('product', 'nome').sort({ createdAt: -1 });
  return res.json(reviews);
});

router.patch('/admin/reviews/:id', authenticateShopAdmin, async (req: Request, res: Response) => {
  const r = await ShopReview.findByIdAndUpdate(req.params.id, { approvato: req.body.approvato === true }, { new: true });
  if (!r) return res.status(404).json({ message: 'Recensione non trovata' });
  return res.json(r);
});

router.delete('/admin/reviews/:id', authenticateShopAdmin, async (req: Request, res: Response) => {
  await ShopReview.findByIdAndDelete(req.params.id);
  return res.json({ ok: true });
});

// Ordini — lista + aggiornamento stato
router.get('/admin/orders', authenticateShopAdmin, async (_req: Request, res: Response) => {
  const orders = await ShopOrder.find().sort({ createdAt: -1 }).limit(200);
  return res.json(orders);
});

router.patch('/admin/orders/:id', authenticateShopAdmin, async (req: Request, res: Response) => {
  const { stato, noteAdmin, totale } = req.body || {};
  const update: any = {};
  if (stato) update.stato = stato;
  if (noteAdmin !== undefined) update.noteAdmin = noteAdmin;
  if (totale !== undefined) update.totale = Number(totale) || 0;
  const o = await ShopOrder.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!o) return res.status(404).json({ message: 'Ordine non trovato' });
  return res.json(o);
});

router.delete('/admin/orders/:id', authenticateShopAdmin, async (req: Request, res: Response) => {
  const o = await ShopOrder.findByIdAndDelete(req.params.id);
  if (!o) return res.status(404).json({ message: 'Ordine non trovato' });
  return res.json({ ok: true });
});

// Config — get/set link PayPal
router.get('/admin/config', authenticateShopAdmin, async (_req: Request, res: Response) => {
  const cfg = await ShopConfig.findOne() || await ShopConfig.create({});
  return res.json(cfg);
});

router.put('/admin/config', authenticateShopAdmin, async (req: Request, res: Response) => {
  const { paypalLink, linkCarta, iban, noteCheckout, offerte, telefonoAssistenza, whatsappAssistenza, emailAssistenza } = req.body || {};
  const cfg = await ShopConfig.findOneAndUpdate(
    {},
    {
      paypalLink: paypalLink?.trim() || '',
      linkCarta: linkCarta?.trim() || '',
      iban: iban?.trim() || '',
      noteCheckout: noteCheckout?.trim() || '',
      offerte: Array.isArray(offerte) ? offerte.map((o: string) => String(o).trim()).filter(Boolean) : [],
      telefonoAssistenza: telefonoAssistenza?.trim() || '',
      whatsappAssistenza: whatsappAssistenza?.trim() || '',
      emailAssistenza: emailAssistenza?.trim() || '',
    },
    { new: true, upsert: true }
  );
  return res.json(cfg);
});

export default router;
