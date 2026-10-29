import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import CandidatoIntermediazione from '../models/CandidatoIntermediazione';
import Staff from '../models/Staff';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { rateLimitByIP } from '../middleware/rateLimit';
import { inviaEmail, inviaEmailConfermaRichiesta } from '../utils/email';

// ═══════════════════════════════════════════════════════════════════════════
// CANDIDATI INTERMEDIAZIONE — iscrizione rapida badanti/colf/assistenti
// familiari dal link pubblico /iscriviti-intermediazione (senza login).
// Flusso: candidatura → notifica email admin → accettazione in Gestione
// Utenti → creazione Staff con modalitaAbilitata 'intermediazione'.
// ═══════════════════════════════════════════════════════════════════════════

const router = Router();
const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const uploadsDir = path.join(__dirname, '../../uploads/candidati-intermediazione');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const RUOLO_LABEL: Record<string, string> = {
  badante: 'Badante', colf: 'Colf', assistente_familiare: 'Assistente familiare',
  oss: 'OSS', infermiere: 'Infermiere', medico: 'Medico', fisioterapista: 'Fisioterapista',
};
const RUOLO_TO_CATEGORY: Record<string, string> = {
  badante: 'badante', colf: 'colf', assistente_familiare: 'assistente-familiare',
  oss: 'oss', infermiere: 'infermieristico', medico: 'medico', fisioterapista: 'riabilitativo',
};

const s = (v: any) => String(v ?? '').trim();
const b = (v: any) => v === true || v === 'true' || v === '1' || v === 'on';

// ─── POST /pubblica — iscrizione pubblica dal link esterno (multipart) ────────
router.post('/pubblica', rateLimitByIP(10, 60 * 60 * 1000), upload.single('documento'), async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const nome = s(body.nome);
    const cognome = s(body.cognome);
    const ruolo = s(body.ruolo);
    if (!nome || !cognome) {
      return res.status(400).json({ message: 'Nome e cognome sono necessari per la candidatura.' });
    }
    if (!RUOLO_LABEL[ruolo]) {
      return res.status(400).json({ message: 'Ruolo non valido.' });
    }

    let documentoPath: string | undefined;
    let documentoNome: string | undefined;
    let documentoMime: string | undefined;
    const file = (req as any).file as Express.Multer.File | undefined;
    if (file) {
      const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
      if (!ok) {
        return res.status(400).json({ message: 'Il documento deve essere una foto o un PDF.' });
      }
      const ext = path.extname(file.originalname || '') || (file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
      const dir = path.join(uploadsDir, `${Date.now()}_${nome.replace(/[^a-z0-9]/gi, '_')}_${cognome.replace(/[^a-z0-9]/gi, '_')}`);
      fs.mkdirSync(dir, { recursive: true });
      const fname = `documento${ext}`;
      fs.writeFileSync(path.join(dir, fname), file.buffer);
      documentoPath = path.join('candidati-intermediazione', path.basename(dir), fname).replace(/\\/g, '/');
      documentoNome = file.originalname || fname;
      documentoMime = file.mimetype;
    }

    const candidato = await CandidatoIntermediazione.create({
      nome,
      cognome,
      ruolo,
      albo: s(body.albo) || undefined,
      nazionalita: s(body.nazionalita) || undefined,
      dataNascita: body.dataNascita ? new Date(body.dataNascita) : undefined,
      extraUe: b(body.extraUe),
      permessoSoggiorno: s(body.permessoSoggiorno) || undefined,
      codiceFiscale: s(body.codiceFiscale).toUpperCase() || undefined,
      telefono: s(body.telefono) || undefined,
      email: s(body.email).toLowerCase() || undefined,
      regioneResidenza: s(body.regioneResidenza) || undefined,
      cittaResidenza: s(body.cittaResidenza) || undefined,
      regioneInteresse: s(body.regioneInteresse) || undefined,
      cittaInteresse: s(body.cittaInteresse) || undefined,
      disponibilita: ['diurno', 'notturno', 'h24'].includes(s(body.disponibilita)) ? s(body.disponibilita) : undefined,
      residenzaPressoFamiglia: b(body.residenzaPressoFamiglia),
      certificato: b(body.certificato),
      esperienze: s(body.esperienze) || undefined,
      note: s(body.note) || undefined,
      documentoPath,
      documentoNome,
      documentoMime,
    });

    const nomeCompleto = `${nome} ${cognome}`;
    const ruoloLabel = RUOLO_LABEL[ruolo];

    // Notifica admin — nuova iscrizione operatore intermediazione
    const adminEmail = process.env.ADMIN_EMAIL || 'abbracciocuredomiciliari@gmail.com';
    const frontendUrl = process.env.FRONTEND_URL || 'https://app.abbracciocuredomiciliari.it';
    const dettagli: [string, string][] = [
      ['Ruolo', ruoloLabel],
      ['Nazionalità', s(body.nazionalita) || '—'],
      ['Telefono', s(body.telefono) || '—'],
      ['Email', s(body.email) || '—'],
      ['Ordine/Albo', s(body.albo) || '—'],
      ['Zona interesse', [s(body.cittaInteresse), s(body.regioneInteresse)].filter(Boolean).join(', ') || '—'],
      ['Disponibilità', s(body.disponibilita) || '—'],
      ['Documento allegato', documentoNome || 'nessuno'],
    ];
    inviaEmail({
      to: adminEmail,
      subject: `🔔 Nuova iscrizione ${ruoloLabel} (Intermediazioni) — ${nomeCompleto}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
        <h2 style="color:#1e4d8c;margin-top:0;">🔔 Nuova iscrizione operatore — Intermediazioni</h2>
        <p>Un nuovo candidato si è iscritto dal modulo pubblico <strong>badanti/colf/assistenti familiari</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;width:140px;">Nome:</td><td style="padding:8px;">${nomeCompleto}</td></tr>
          ${dettagli.map(([k, v], i) => `<tr><td style="padding:8px;background:${i % 2 ? '#f8fafc' : '#f1f5f9'};font-weight:bold;">${k}:</td><td style="padding:8px;">${v}</td></tr>`).join('')}
        </table>
        <a href="${frontendUrl}/gestione-utenti" style="display:inline-block;background:#1e4d8c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Vai a Gestione Utenti →</a>
      </div>`,
      log: { tipo: 'notifica_iscrizione', area: 'intermediazione', riferimento: nomeCompleto },
    }).catch(() => {});

    // Conferma al candidato (se ha lasciato l'email)
    if (candidato.email) {
      inviaEmailConfermaRichiesta({
        to: candidato.email,
        nome,
        oggettoRichiesta: `iscrizione come ${ruoloLabel}`,
        dettagli: [
          { label: 'Ruolo', valore: ruoloLabel },
          { label: 'Disponibilità', valore: s(body.disponibilita) || '—' },
        ],
        note: 'Dopo l\'accettazione sarai ricontattato per i prossimi passi.',
      }).catch(() => {});
    }

    return res.status(201).json({ message: 'Iscrizione registrata. Ti ricontatteremo dopo la valutazione.', id: candidato._id });
  } catch (error: any) {
    console.error('[Candidati intermediazione] Errore iscrizione pubblica:', error);
    return res.status(500).json({ message: 'Errore nella registrazione della candidatura' });
  }
});

// ─── GET / — lista candidati (gestione) ─────────────────────────────────────
router.get('/', authenticateToken, authorizeRole(...RUOLI_GESTIONE), async (req: Request, res: Response) => {
  try {
    const stato = req.query.stato as string | undefined;
    const query: any = {};
    if (stato && stato !== 'tutti') query.stato = stato;
    const lista = await CandidatoIntermediazione.find(query).sort({ createdAt: -1 }).lean();
    return res.json(lista);
  } catch (error) {
    return res.status(500).json({ message: 'Errore caricamento candidati', error });
  }
});

// ─── GET /conteggio — numero in attesa (badge) ──────────────────────────────
router.get('/conteggio', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const n = await CandidatoIntermediazione.countDocuments({ stato: 'in_attesa' });
    return res.json({ inAttesa: n });
  } catch {
    return res.json({ inAttesa: 0 });
  }
});

// ─── GET /:id/documento — scarica il documento allegato (gestione) ──────────
router.get('/:id/documento', authenticateToken, authorizeRole(...RUOLI_GESTIONE), async (req: Request, res: Response) => {
  try {
    const c = await CandidatoIntermediazione.findById(req.params.id);
    if (!c?.documentoPath) return res.status(404).json({ message: 'Nessun documento allegato' });
    const abs = path.join(__dirname, '../../uploads', c.documentoPath);
    if (!fs.existsSync(abs)) return res.status(404).json({ message: 'File non trovato sul server' });
    res.setHeader('Content-Type', c.documentoMime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${c.documentoNome || 'documento'}"`);
    return res.sendFile(abs);
  } catch (error) {
    return res.status(500).json({ message: 'Errore lettura documento', error });
  }
});

// ─── POST /:id/richiedi-dati — chiede al candidato i dati mancanti ─────────
// canale 'email' → invia vera email aziendale (archiviata in EmailLog);
// canale 'whatsapp' → registra soltanto la richiesta (il messaggio parte
// dal gestionale via wa.me lato client, non esiste API WhatsApp).
router.post('/:id/richiedi-dati', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('candidati_intermediazione', 'UPDATE'), async (req: Request, res: Response) => {
  try {
    const c = await CandidatoIntermediazione.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Candidato non trovato' });
    const campi = (Array.isArray(req.body?.campi) ? req.body.campi : []).map(s).filter(Boolean).slice(0, 12);
    if (!campi.length) return res.status(400).json({ message: 'Indica almeno un dato da richiedere' });
    const canale = req.body?.canale === 'email' ? 'email' : 'whatsapp';

    if (canale === 'email') {
      if (!c.email) return res.status(400).json({ message: 'Il candidato non ha lasciato un indirizzo email' });
      const ruoloLabel = RUOLO_LABEL[c.ruolo] || c.ruolo;
      await inviaEmail({
        to: c.email,
        subject: `Abbraccio — completa la tua iscrizione: dati mancanti`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
          <h2 style="color:#1e4d8c;margin-top:0;">Completa la tua iscrizione</h2>
          <p>Ciao ${c.nome},</p>
          <p>grazie per la tua iscrizione come <strong>${ruoloLabel}</strong> alla rete Abbraccio Cure Domiciliari. Per valutare la tua candidatura ci mancano ancora questi dati:</p>
          <ul style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 14px 14px 34px;line-height:1.8;">
            ${campi.map((f: string) => `<li>${f}</li>`).join('')}
          </ul>
          <p>Puoi rispondere <strong>direttamente a questa email</strong> con i dati mancanti — per il documento basta allegare una foto o un PDF.</p>
          <p style="color:#64748b;font-size:13px;">Grazie,<br><strong>Abbraccio Cure Domiciliari</strong><br>Tel. 06 01905242</p>
        </div>`,
        log: { tipo: 'richiesta_dati', area: 'intermediazione', riferimento: `${c.nome} ${c.cognome}` },
      });
    }

    c.richiesteDati = [...(c.richiesteDati || []), { at: new Date(), campi, canale } as any];
    await c.save();
    return res.json({ message: canale === 'email' ? `Email di richiesta inviata a ${c.email}` : 'Richiesta registrata' });
  } catch (error: any) {
    console.error('[Candidati intermediazione] Errore richiesta dati:', error);
    return res.status(500).json({ message: 'Errore invio richiesta dati', error: error.message });
  }
});

// ─── PATCH /:id/accetta — crea Staff intermediazione ────────────────────────
router.patch('/:id/accetta', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('candidati_intermediazione', 'UPDATE'), async (req: Request, res: Response) => {
  try {
    const c = await CandidatoIntermediazione.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Candidato non trovato' });
    if (c.stato === 'accettato') return res.status(400).json({ message: 'Candidato già accettato' });

    // Staff.email è required+unique: se il candidato non l'ha data uso un placeholder tecnico
    const emailStaff = c.email || `candidato.${String(c._id)}@intermediazione.local`;

    // Email già nel personale → niente duplicati: se è la stessa persona la
    // candidatura viene collegata allo staff esistente (abilitando anche le
    // Intermediazioni se serve); se è un'altra persona, errore chiaro.
    const esistente = await Staff.findOne({ email: emailStaff });
    if (esistente) {
      const stessaPersona =
        (esistente.firstName || '').toLowerCase().trim() === c.nome.toLowerCase().trim() &&
        (esistente.lastName || '').toLowerCase().trim() === c.cognome.toLowerCase().trim();
      if (!stessaPersona) {
        return res.status(409).json({ message: `L'email ${emailStaff} è già registrata nel personale a nome di ${esistente.firstName} ${esistente.lastName}. Se è la stessa persona chiedi al candidato un'email diversa, altrimenti rifiuta la candidatura.` });
      }
      const giaIntermediazione = esistente.areaIntermediazione || ['intermediazione', 'entrambi'].includes(esistente.modalitaAbilitata);
      if (!giaIntermediazione) {
        esistente.areaIntermediazione = true;
        esistente.modalitaAbilitata = 'entrambi';
        await esistente.save();
      }
      c.stato = 'accettato';
      c.staffId = esistente._id as any;
      if (req.body?.nota) c.noteAdmin = s(req.body.nota);
      await c.save();
      return res.json({ message: giaIntermediazione
        ? `${c.nome} ${c.cognome} era già nel Personale Intermediazioni — candidatura collegata`
        : `${c.nome} ${c.cognome} era già nel personale — abilitato/a anche alle Intermediazioni`, staffId: esistente._id });
    }

    const noteStaff = [
      c.esperienze ? `Esperienze: ${c.esperienze}` : '',
      c.note ? `Note: ${c.note}` : '',
      c.nazionalita ? `Nazionalità: ${c.nazionalita}` : '',
      c.extraUe ? `Permesso di soggiorno: ${c.permessoSoggiorno || 'da verificare'}` : '',
      c.disponibilita ? `Disponibilità: ${c.disponibilita}${c.disponibilita === 'h24' && c.residenzaPressoFamiglia ? ' (residente presso famiglia)' : ''}` : '',
      c.certificato ? 'Lavoratore certificato' : '',
      c.albo ? `Ordine/Albo: ${c.albo}` : '',
      [c.cittaInteresse, c.regioneInteresse].filter(Boolean).length ? `Zona di interesse: ${[c.cittaInteresse, c.regioneInteresse].filter(Boolean).join(', ')}` : '',
    ].filter(Boolean).join(' | ');

    const staff = await Staff.create({
      firstName: c.nome,
      lastName: c.cognome,
      email: emailStaff,
      role: RUOLO_LABEL[c.ruolo],
      category: RUOLO_TO_CATEGORY[c.ruolo],
      phone: c.telefono,
      codiceFiscale: c.codiceFiscale,
      cittaResidenza: c.cittaResidenza || c.cittaInteresse,
      indirizzoResidenza: [c.cittaResidenza, c.regioneResidenza].filter(Boolean).join(', ') || undefined,
      note: noteStaff || undefined,
      modalitaAbilitata: 'intermediazione',
      areaIntermediazione: true,
      professionista: !!c.certificato || ['oss', 'infermiere', 'medico', 'fisioterapista'].includes(c.ruolo),
    });

    c.stato = 'accettato';
    c.staffId = staff._id as any;
    if (req.body?.nota) c.noteAdmin = s(req.body.nota);
    await c.save();
    return res.json({ message: `${c.nome} ${c.cognome} accettato/a — ora in Personale Intermediazioni`, staffId: staff._id });
  } catch (error: any) {
    console.error('[Candidati intermediazione] Errore accettazione:', error);
    if (error?.code === 11000 && error?.keyPattern?.email) {
      return res.status(409).json({ message: `Email già presente nel personale: ${error.keyValue?.email}. Verifica con "Richiedi dati" o rifiuta.` });
    }
    return res.status(500).json({ message: 'Errore accettazione', error: error.message });
  }
});

// ─── PATCH /:id/rifiuta ─────────────────────────────────────────────────────
router.patch('/:id/rifiuta', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('candidati_intermediazione', 'UPDATE'), async (req: Request, res: Response) => {
  try {
    const c = await CandidatoIntermediazione.findById(req.params.id);
    if (!c) return res.status(404).json({ message: 'Candidato non trovato' });
    c.stato = 'rifiutato';
    if (req.body?.nota) c.noteAdmin = s(req.body.nota);
    await c.save();
    return res.json({ message: 'Candidatura rifiutata' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore rifiuto', error });
  }
});

// ─── DELETE /:id ────────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, authorizeRole('admin'), auditLog('candidati_intermediazione', 'DELETE'), async (req: Request, res: Response) => {
  try {
    await CandidatoIntermediazione.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Candidatura eliminata' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore eliminazione', error });
  }
});

export default router;
