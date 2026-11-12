// ═══════════════════════════════════════════════════════════════════════════
// Adattatore pubblico per i nuovi siti (principale / famiglie / shop).
// Espone il contratto del pacchetto (/api/public, /api/orders, /api/applications)
// mappandolo sui modelli reali del gestionale: nessun dato demo, tutto entra
// nelle collezioni vere (ShopOrder, CandidatoIntermediazione).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import ShopProduct from '../models/ShopProduct';
import ShopOrder from '../models/ShopOrder';
import CandidatoIntermediazione from '../models/CandidatoIntermediazione';
import { rateLimitByIP } from '../middleware/rateLimit';
import { inviaEmail } from '../utils/email';

const router = Router();
const s = (v: any) => String(v ?? '').trim();

const uploadsDir = path.join(__dirname, '../../uploads/candidati-intermediazione');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Contenuti base dei tre siti (title/subtitle/hero usati da cms-bridge).
// I valori coincidono con seed.json del pacchetto; in futuro gestibili da admin.
const SITES_CONTENT = [
  { id: 'main',   name: 'Sito principale',     title: 'La cura, dove sei tu.',        subtitle: 'Competenza, ascolto e una presenza su cui contare.', photo: 'assets/hero.jpg',     video: 'assets/media/sequenza-completa.mp4' },
  { id: 'family', name: 'Abbraccio Famiglie',  title: 'L’aiuto che fa casa.',         subtitle: 'Una presenza in più. Una preoccupazione in meno.',   photo: 'assets/famiglia.jpg', video: 'assets/sequenza-completa.mp4' },
  { id: 'shop',   name: 'Shop e noleggio',     title: 'Piccoli aiuti. Grande autonomia.', subtitle: 'Ausili e dispositivi per la quotidianità.',    photo: 'assets/shop-hero.jpg', video: '' },
];

const apiBaseOf = (req: Request) => `${req.protocol}://${req.get('host')}`;

// ─── GET /public — contenuti + catalogo shop reale ───────────────────────────
router.get('/public', async (req: Request, res: Response) => {
  try {
    const base = apiBaseOf(req);
    const prods = await ShopProduct.find({ attivo: true, categoria: { $in: ['vendita', 'noleggio'] } }).sort({ ordine: 1, createdAt: -1 });
    const products = prods.map(p => {
      const n = p.prezzoNoleggio || {};
      const isRent = p.categoria === 'noleggio';
      const price = isRent
        ? (n.giorno || (n.settimana ? Math.round(n.settimana / 7 * 100) / 100 : 0) || (n.mese ? Math.round(n.mese / 30 * 100) / 100 : 0))
        : ((p.inOfferta && (p.prezzoScontato || 0) > 0) ? p.prezzoScontato! : (p.prezzo || 0));
      const img = p.immagini?.[0] || '';
      return {
        id: p._id.toString(),
        name: p.nome,
        mode: isRent ? 'Noleggio' : 'Acquisto',
        category: (p as any).sezione || 'Cura quotidiana',
        price,
        stock: p.disponibile ? 99 : 0,
        active: true,
        icon: 'bag',
        desc: p.descrizione || '',
        image: img.startsWith('/') ? base + img : img,
      };
    });
    return res.json({ content: SITES_CONTENT, products });
  } catch (err) {
    return res.status(500).json({ error: 'Contenuti non disponibili', details: String(err) });
  }
});

// ─── POST /orders — ordine shop reale (stessa logica server-side di /shop) ───
router.post('/orders', rateLimitByIP(20, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const { items, customer, email, phone, address, delivery, method, terms } = req.body || {};
    if (terms !== true && terms !== 'on' && terms !== 'true') {
      return res.status(400).json({ error: 'Accetta le condizioni di vendita/noleggio e la privacy.' });
    }
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Carrello vuoto.' });
    if (!s(customer) || !s(email) || !s(phone)) {
      return res.status(400).json({ error: 'Nome, email e telefono sono obbligatori.' });
    }
    if (!['carta', 'bonifico'].includes(s(method))) {
      return res.status(400).json({ error: 'Metodo di pagamento non valido.' });
    }

    const ids = items.map((i: any) => s(i.id)).filter(Boolean);
    const prods = await ShopProduct.find({ _id: { $in: ids }, attivo: true, categoria: { $in: ['vendita', 'noleggio'] } });
    const pmap = new Map(prods.map(p => [p._id.toString(), p]));

    let totale = 0;
    let hasNoleggio = false;
    const finalItems: any[] = [];
    const MS_DAY = 24 * 60 * 60 * 1000;
    for (const i of items) {
      const p = pmap.get(s(i.id));
      if (!p) return res.status(400).json({ error: `Prodotto non valido: ${i.id}` });
      if (!p.disponibile) return res.status(400).json({ error: `"${p.nome}" non è disponibile` });
      const qty = Math.max(1, Math.min(99, Number(i.qty) || 1));
      if (p.categoria === 'noleggio') {
        hasNoleggio = true;
        const start = new Date(s(i.start) + 'T00:00:00');
        const end = new Date(s(i.end) + 'T00:00:00');
        const days = Math.round((end.getTime() - start.getTime()) / MS_DAY) + 1;
        if (!days || days < 1 || days > 180 || isNaN(days)) {
          return res.status(400).json({ error: `Periodo di noleggio non valido per "${p.nome}".` });
        }
        const n = p.prezzoNoleggio || {};
        const prezzoGiorno = n.giorno || (n.settimana ? n.settimana / 7 : 0) || (n.mese ? n.mese / 30 : 0);
        if (!(prezzoGiorno > 0)) return res.status(400).json({ error: `Tariffa di noleggio non definita per "${p.nome}".` });
        const qtyEff = qty * days; // il totale è prezzo/giorno × giorni × unità
        totale += prezzoGiorno * qtyEff;
        finalItems.push({ product: p._id, nome: `${p.nome} (noleggio ${days} gg${qty > 1 ? ` × ${qty}` : ''})`, prezzo: Math.round(prezzoGiorno * 100) / 100, qty: qtyEff, tariffa: 'giorno' });
      } else {
        const prezzoEff = (p.inOfferta && (p.prezzoScontato || 0) > 0) ? p.prezzoScontato! : (p.prezzo || 0);
        totale += prezzoEff * qty;
        finalItems.push({ product: p._id, nome: p.nome, prezzo: prezzoEff, qty });
      }
    }
    totale = Math.round(totale * 100) / 100;

    const noteParts: string[] = [];
    if (s(delivery)) noteParts.push(`Consegna: ${s(delivery) === 'consegna' ? 'a domicilio (da concordare)' : 'ritiro al centro'}`);
    const order = await ShopOrder.create({
      tipo: hasNoleggio ? 'noleggio' : 'acquisto',
      metodoPagamento: s(method),
      items: finalItems,
      cliente: {
        nome: s(customer), email: s(email).toLowerCase(),
        telefono: s(phone), indirizzo: s(address) || '',
        note: noteParts.join(' · '),
      },
      totale,
    });

    const adminEmail = process.env.ADMIN_EMAIL || 'abbracciocuredomiciliari@gmail.com';
    inviaEmail({
      to: adminEmail,
      subject: `🛒 Nuovo ordine Shop #${order._id.toString().slice(-6)} — €${totale.toFixed(2)}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
        <h2 style="color:#1e4d8c;">🛒 Nuovo ordine dallo Shop (nuovo sito)</h2>
        <p><strong>Cliente:</strong> ${s(customer)} · ${s(email)} · ${s(phone)}<br>
        ${s(address) ? `<strong>Consegna:</strong> ${s(address)} · ` : ''}<strong>Pagamento:</strong> ${s(method) === 'carta' ? 'Carta' : 'Bonifico'}</p>
        <ul>${finalItems.map(it => `<li>${it.nome} — ${it.qty} × €${it.prezzo.toFixed(2)}</li>`).join('')}</ul>
        <p><strong>TOTALE: €${totale.toFixed(2)}</strong></p>
      </div>`,
    }).catch(() => {});

    // Contratto del pacchetto: {id} oppure {id, beneficiary, iban, reference} per bonifico.
    return res.status(201).json({ id: order._id.toString(), totale });
  } catch (err) {
    return res.status(500).json({ error: 'Ordine non riuscito', details: String(err) });
  }
});

// ─── POST /applications — candidatura lavora-con-noi → CandidatoIntermediazione
const ROLE_MAP: Record<string, string> = {
  'infermiere/a': 'infermiere', 'infermiere': 'infermiere',
  'oss': 'oss', 'medico/a': 'medico', 'medico': 'medico',
  'badante': 'badante', 'assistente familiare': 'assistente_familiare',
  'colf': 'colf', 'fisioterapista': 'fisioterapista',
};

router.post('/applications', rateLimitByIP(10, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const b = req.body || {};
    const role = ROLE_MAP[s(b.role).toLowerCase()];
    if (!role) return res.status(400).json({ error: 'Seleziona il ruolo.' });
    if (!s(b.name)) return res.status(400).json({ error: 'Nome e cognome obbligatori.' });
    if (!s(b.phone)) return res.status(400).json({ error: 'Telefono obbligatorio.' });
    if (!s(b.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s(b.email))) {
      return res.status(400).json({ error: 'Email non valida.' });
    }
    if (!b.consent) return res.status(400).json({ error: 'Serve il consenso al trattamento dei dati.' });

    const parts = s(b.name).split(/\s+/);
    const nome = parts[0];
    const cognome = parts.slice(1).join(' ') || '—';

    // CV: base64 dal frontend → salvataggio privato (fuori dalla cartella pubblica)
    let documentoPath: string | undefined;
    let documentoNome: string | undefined;
    let documentoMime: string | undefined;
    if (b.cv && b.cv.data) {
      const nome1 = s(b.cv.name) || 'cv.pdf';
      if (!nome1.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'Il curriculum deve essere un PDF.' });
      }
      const buf = Buffer.from(String(b.cv.data), 'base64');
      if (!buf.length || buf.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'PDF non valido o oltre 5 MB.' });
      }
      if (buf.slice(0, 4).toString() !== '%PDF') {
        return res.status(400).json({ error: 'Il file non sembra un PDF valido.' });
      }
      const dir = path.join(uploadsDir, `${Date.now()}_${nome.replace(/[^a-z0-9]/gi, '_')}_${cognome.replace(/[^a-z0-9]/gi, '_')}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'cv.pdf'), buf);
      documentoPath = path.join('candidati-intermediazione', path.basename(dir), 'cv.pdf').replace(/\\/g, '/');
      documentoNome = nome1;
      documentoMime = 'application/pdf';
    }

    const note = [
      b.qualification && `Qualifica: ${s(b.qualification)}`,
      b.experience && `Esperienza: ${s(b.experience)}`,
      b.area && `Zone: ${s(b.area)}`,
      b.availability && `Disponibilità: ${s(b.availability)}`,
      b.message && `Messaggio: ${s(b.message)}`,
      'Fonte: sito web lavora-con-noi',
    ].filter(Boolean).join('\n');

    const candidato = await CandidatoIntermediazione.create({
      nome, cognome, ruolo: role,
      telefono: s(b.phone), email: s(b.email).toLowerCase(),
      note, documentoPath, documentoNome, documentoMime,
    } as any);

    const adminEmail = process.env.ADMIN_EMAIL || 'abbracciocuredomiciliari@gmail.com';
    inviaEmail({
      to: adminEmail,
      subject: `📋 Nuova candidatura dal sito — ${nome} ${cognome} (${s(b.role)})`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#1e4d8c;">Nuova candidatura — Lavora con noi</h2>
        <p><strong>${nome} ${cognome}</strong> · ${s(b.role)}<br>${s(b.email)} · ${s(b.phone)}</p>
        <pre style="background:#f8fafc;padding:12px;border-radius:6px;white-space:pre-wrap;">${note}</pre>
        ${documentoNome ? `<p>CV allegato: ${documentoNome} (archivio privato)</p>` : ''}
      </div>`,
    }).catch(() => {});

    return res.status(201).json({ ok: true, id: candidato._id });
  } catch (err) {
    return res.status(500).json({ error: 'Invio non riuscito', details: String(err) });
  }
});

export default router;
