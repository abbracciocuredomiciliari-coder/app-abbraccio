// ═══════════════════════════════════════════════════════════════════════════
// SITI WEB E SHOP — area riservata del gestionale (admin / coordinatore).
//   Contenuti hero dei tre siti: titolo, sottotitolo, foto, video
//   Prodotti shop: CRUD + immagini (stesso modello ShopProduct dello shop)
// I siti pubblici leggono tutto da GET /api/public (sitiPubblici.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import SiteContent, { SiteId } from '../models/SiteContent';
import ShopProduct from '../models/ShopProduct';
import ShopReview from '../models/ShopReview';

const router = Router();
router.use(authenticateToken, authorizeRole('admin', 'coordinator', 'direttore'));

const SITES: SiteId[] = ['main', 'family', 'shop'];
export const SITE_MEDIA_DIR = path.join(process.cwd(), 'uploads', 'siti');
const SHOP_IMG_DIR = path.join(process.cwd(), 'uploads', 'shop');
[SITE_MEDIA_DIR, SHOP_IMG_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const safeName = (orig: string) => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(orig || '').toLowerCase()}`;
const uploadMedia = multer({
  storage: multer.diskStorage({ destination: (_r, _f, cb) => cb(null, SITE_MEDIA_DIR), filename: (_r, f, cb) => cb(null, safeName(f.originalname)) }),
  limits: { fileSize: 24 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => {
    const okImg = /^image\/(jpeg|png|webp)$/.test(f.mimetype);
    const okVid = /^video\/(mp4|webm|quicktime)$/.test(f.mimetype);
    if (okImg || okVid) cb(null, true); else cb(new Error('Formato non consentito: foto JPG/PNG/WEBP o video MP4/WEBM/MOV'));
  },
});
const uploadImg = multer({
  storage: multer.diskStorage({ destination: (_r, _f, cb) => cb(null, SHOP_IMG_DIR), filename: (_r, f, cb) => cb(null, safeName(f.originalname)) }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => (/^image\/(jpeg|png|webp)$/.test(f.mimetype) ? cb(null, true) : cb(new Error('Solo immagini JPG/PNG/WEBP'))),
});
const withUpload = (mw: any) => (req: AuthRequest, res: Response, next: any) =>
  mw(req, res, (err: any) => (err ? res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'File troppo grande' : (err.message || 'Upload non riuscito') }) : next()));

const who = (req: AuthRequest) => (typeof req.user === 'object' && (req.user as any)?.name) || 'admin';
const removeFile = (dir: string, url: string) => {
  if (!url) return;
  const f = path.join(dir, path.basename(url));
  if (fs.existsSync(f)) fs.unlink(f, () => {});
};
async function getOrCreate(site: SiteId) {
  return (await SiteContent.findOne({ site })) || SiteContent.create({ site });
}

// ─── CONTENUTI SITI ──────────────────────────────────────────────────────────
router.get('/contenuti', async (_req, res: Response) => {
  const docs = await Promise.all(SITES.map(getOrCreate));
  return res.json(docs.map(d => ({ site: d.site, title: d.title, subtitle: d.subtitle, photo: d.photo, video: d.video, updatedByName: d.updatedByName, updatedAt: (d as any).updatedAt, storico: (d.storico || []).slice(-15).reverse() })));
});

router.put('/contenuti/:site', async (req: AuthRequest, res: Response) => {
  const site = req.params.site as SiteId;
  if (!SITES.includes(site)) return res.status(400).json({ message: 'Sito non valido' });
  const doc = await getOrCreate(site);
  const by = who(req);
  for (const campo of ['title', 'subtitle'] as const) {
    if (typeof req.body?.[campo] !== 'string') continue;
    const v = String(req.body[campo]).trim().slice(0, campo === 'title' ? 120 : 300);
    if (v !== doc[campo]) { const precedente = doc[campo]; doc[campo] = v; doc.storico.push({ at: new Date(), by, campo, valore: v, precedente }); }
  }
  doc.updatedByName = by;
  await doc.save();
  return res.json(doc);
});

router.post('/contenuti/:site/media', withUpload(uploadMedia.single('file')), async (req: AuthRequest, res: Response) => {
  const site = req.params.site as SiteId;
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!SITES.includes(site)) { if (file) fs.unlink(file.path, () => {}); return res.status(400).json({ message: 'Sito non valido' }); }
  if (!file) return res.status(400).json({ message: 'File mancante' });
  const campo = file.mimetype.startsWith('video/') ? 'video' : 'photo';
  const doc = await getOrCreate(site);
  const old = doc[campo];
  doc[campo] = `/site-media/${file.filename}`;
  doc.updatedByName = who(req);
  doc.storico.push({ at: new Date(), by: who(req), campo, valore: file.originalname, precedente: old });
  await doc.save();
  removeFile(SITE_MEDIA_DIR, old);
  return res.json(doc);
});

// Ripristina foto/video originali del sito
router.delete('/contenuti/:site/media/:campo', async (req: AuthRequest, res: Response) => {
  const site = req.params.site as SiteId;
  const campo = req.params.campo === 'video' ? 'video' : 'photo';
  if (!SITES.includes(site)) return res.status(400).json({ message: 'Sito non valido' });
  const doc = await getOrCreate(site);
  const precedente = doc[campo];
  removeFile(SITE_MEDIA_DIR, precedente);
  doc[campo] = '';
  doc.updatedByName = who(req);
  doc.storico.push({ at: new Date(), by: who(req), campo, valore: '(originale ripristinato)', precedente });
  await doc.save();
  return res.json(doc);
});

// ─── PRODOTTI SHOP ───────────────────────────────────────────────────────────
const num = (v: any) => Math.max(0, Number(v) || 0);
function productData(b: any) {
  const out: any = {};
  if (typeof b.nome === 'string') out.nome = b.nome.trim().slice(0, 160);
  if (typeof b.descrizione === 'string') out.descrizione = b.descrizione.trim().slice(0, 3000);
  if (['vendita', 'noleggio'].includes(b.categoria)) out.categoria = b.categoria;
  if (typeof b.sezione === 'string') out.sezione = b.sezione.trim().slice(0, 60);
  if (b.prezzo !== undefined) out.prezzo = num(b.prezzo);
  if (b.prezzoScontato !== undefined) out.prezzoScontato = num(b.prezzoScontato);
  if (b.inOfferta !== undefined) out.inOfferta = !!b.inOfferta;
  if (b.prezzoNoleggio) out.prezzoNoleggio = { giorno: num(b.prezzoNoleggio.giorno), settimana: num(b.prezzoNoleggio.settimana), mese: num(b.prezzoNoleggio.mese) };
  if (b.cauzione !== undefined) out.cauzione = num(b.cauzione);
  if (b.disponibile !== undefined) out.disponibile = !!b.disponibile;
  if (b.attivo !== undefined) out.attivo = !!b.attivo;
  if (b.ordine !== undefined) out.ordine = Number(b.ordine) || 0;
  if (typeof b.badge === 'string') out.badge = b.badge.trim().slice(0, 40);
  if (typeof b.tempoSpedizione === 'string') out.tempoSpedizione = b.tempoSpedizione.trim().slice(0, 80);
  return out;
}

router.get('/prodotti', async (_req, res: Response) => {
  const list = await ShopProduct.find({ categoria: { $in: ['vendita', 'noleggio'] } }).sort({ ordine: 1, createdAt: -1 });
  return res.json(list);
});

router.post('/prodotti', async (req: AuthRequest, res: Response) => {
  const data = productData(req.body || {});
  if (!data.nome || !data.categoria) return res.status(400).json({ message: 'Nome e tipo (vendita o noleggio) obbligatori' });
  const p = await ShopProduct.create({ immagini: [], ...data });
  return res.status(201).json(p);
});

router.put('/prodotti/:id', async (req: AuthRequest, res: Response) => {
  const data = productData(req.body || {});
  if (data.nome === '') return res.status(400).json({ message: 'Il nome non può essere vuoto' });
  const p = await ShopProduct.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  if (!p) return res.status(404).json({ message: 'Prodotto non trovato' });
  return res.json(p);
});

router.delete('/prodotti/:id', async (req: AuthRequest, res: Response) => {
  const p = await ShopProduct.findByIdAndDelete(req.params.id);
  if (!p) return res.status(404).json({ message: 'Prodotto non trovato' });
  await ShopReview.deleteMany({ product: p._id });
  (p.immagini || []).forEach(src => removeFile(SHOP_IMG_DIR, src));
  return res.json({ ok: true });
});

router.post('/prodotti/:id/immagini', withUpload(uploadImg.single('file')), async (req: AuthRequest, res: Response) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  const p = await ShopProduct.findById(req.params.id);
  if (!p) { if (file) fs.unlink(file.path, () => {}); return res.status(404).json({ message: 'Prodotto non trovato' }); }
  if (!file) return res.status(400).json({ message: 'File mancante' });
  p.immagini.push(`/shop-images/${file.filename}`);
  await p.save();
  return res.json(p);
});

router.delete('/prodotti/:id/immagini', async (req: AuthRequest, res: Response) => {
  const p = await ShopProduct.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'Prodotto non trovato' });
  const src = String(req.body?.src || req.query.src || '');
  if (!p.immagini.includes(src)) return res.status(400).json({ message: 'Immagine non trovata' });
  p.immagini = p.immagini.filter(i => i !== src);
  await p.save();
  removeFile(SHOP_IMG_DIR, src);
  return res.json(p);
});

export default router;
