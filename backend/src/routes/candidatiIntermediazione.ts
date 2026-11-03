// @ts-nocheck
// Ripristinato dalla build deployata su Aruba (codice non committato in precedenza)
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const CandidatoIntermediazione_1 = __importDefault(require("../models/CandidatoIntermediazione"));
const Staff_1 = __importDefault(require("../models/Staff"));
const auth_1 = require("../middleware/auth");
const roles_1 = require("../middleware/roles");
const audit_1 = require("../middleware/audit");
const rateLimit_1 = require("../middleware/rateLimit");
const email_1 = require("../utils/email");
const router = (0, express_1.Router)();
const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const uploadsDir = path_1.default.join(__dirname, '../../uploads/candidati-intermediazione');
if (!fs_1.default.existsSync(uploadsDir))
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
const RUOLO_LABEL = {
    badante: 'Badante', colf: 'Colf', assistente_familiare: 'Assistente familiare',
    oss: 'OSS', infermiere: 'Infermiere', medico: 'Medico', fisioterapista: 'Fisioterapista',
};
const RUOLO_TO_CATEGORY = {
    badante: 'badante', colf: 'colf', assistente_familiare: 'assistente-familiare',
    oss: 'oss', infermiere: 'infermieristico', medico: 'medico', fisioterapista: 'riabilitativo',
};
const s = (v) => String(v ?? '').trim();
const b = (v) => v === true || v === 'true' || v === '1' || v === 'on';
router.post('/pubblica', (0, rateLimit_1.rateLimitByIP)(10, 60 * 60 * 1000), upload.single('documento'), async (req, res) => {
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
        let documentoPath;
        let documentoNome;
        let documentoMime;
        const file = req.file;
        if (file) {
            const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
            if (!ok) {
                return res.status(400).json({ message: 'Il documento deve essere una foto o un PDF.' });
            }
            const ext = path_1.default.extname(file.originalname || '') || (file.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
            const dir = path_1.default.join(uploadsDir, `${Date.now()}_${nome.replace(/[^a-z0-9]/gi, '_')}_${cognome.replace(/[^a-z0-9]/gi, '_')}`);
            fs_1.default.mkdirSync(dir, { recursive: true });
            const fname = `documento${ext}`;
            fs_1.default.writeFileSync(path_1.default.join(dir, fname), file.buffer);
            documentoPath = path_1.default.join('candidati-intermediazione', path_1.default.basename(dir), fname).replace(/\\/g, '/');
            documentoNome = file.originalname || fname;
            documentoMime = file.mimetype;
        }
        const candidato = await CandidatoIntermediazione_1.default.create({
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
        const adminEmail = process.env.ADMIN_EMAIL || 'abbracciocuredomiciliari@gmail.com';
        const frontendUrl = process.env.FRONTEND_URL || 'https://app.abbracciocuredomiciliari.it';
        const dettagli = [
            ['Ruolo', ruoloLabel],
            ['Nazionalità', s(body.nazionalita) || '—'],
            ['Telefono', s(body.telefono) || '—'],
            ['Email', s(body.email) || '—'],
            ['Ordine/Albo', s(body.albo) || '—'],
            ['Zona interesse', [s(body.cittaInteresse), s(body.regioneInteresse)].filter(Boolean).join(', ') || '—'],
            ['Disponibilità', s(body.disponibilita) || '—'],
            ['Documento allegato', documentoNome || 'nessuno'],
        ];
        (0, email_1.inviaEmail)({
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
        }).catch(() => { });
        if (candidato.email) {
            (0, email_1.inviaEmailConfermaRichiesta)({
                to: candidato.email,
                nome,
                oggettoRichiesta: `iscrizione come ${ruoloLabel}`,
                dettagli: [
                    { label: 'Ruolo', valore: ruoloLabel },
                    { label: 'Disponibilità', valore: s(body.disponibilita) || '—' },
                ],
                note: 'Dopo l\'accettazione sarai ricontattato per i prossimi passi.',
            }).catch(() => { });
        }
        return res.status(201).json({ message: 'Iscrizione registrata. Ti ricontatteremo dopo la valutazione.', id: candidato._id });
    }
    catch (error) {
        console.error('[Candidati intermediazione] Errore iscrizione pubblica:', error);
        return res.status(500).json({ message: 'Errore nella registrazione della candidatura' });
    }
});
router.get('/', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), async (req, res) => {
    try {
        const stato = req.query.stato;
        const query = {};
        if (stato && stato !== 'tutti')
            query.stato = stato;
        const lista = await CandidatoIntermediazione_1.default.find(query).sort({ createdAt: -1 }).lean();
        return res.json(lista);
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore caricamento candidati', error });
    }
});
router.get('/conteggio', auth_1.authenticateToken, async (_req, res) => {
    try {
        const n = await CandidatoIntermediazione_1.default.countDocuments({ stato: 'in_attesa' });
        return res.json({ inAttesa: n });
    }
    catch {
        return res.json({ inAttesa: 0 });
    }
});
router.get('/:id/documento', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), async (req, res) => {
    try {
        const c = await CandidatoIntermediazione_1.default.findById(req.params.id);
        if (!c?.documentoPath)
            return res.status(404).json({ message: 'Nessun documento allegato' });
        const abs = path_1.default.join(__dirname, '../../uploads', c.documentoPath);
        if (!fs_1.default.existsSync(abs))
            return res.status(404).json({ message: 'File non trovato sul server' });
        res.setHeader('Content-Type', c.documentoMime || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${c.documentoNome || 'documento'}"`);
        return res.sendFile(abs);
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore lettura documento', error });
    }
});
router.post('/:id/richiedi-dati', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), (0, audit_1.auditLog)('candidati_intermediazione', 'UPDATE'), async (req, res) => {
    try {
        const c = await CandidatoIntermediazione_1.default.findById(req.params.id);
        if (!c)
            return res.status(404).json({ message: 'Candidato non trovato' });
        const campi = (Array.isArray(req.body?.campi) ? req.body.campi : []).map(s).filter(Boolean).slice(0, 12);
        if (!campi.length)
            return res.status(400).json({ message: 'Indica almeno un dato da richiedere' });
        const canale = req.body?.canale === 'email' ? 'email' : 'whatsapp';
        if (canale === 'email') {
            if (!c.email)
                return res.status(400).json({ message: 'Il candidato non ha lasciato un indirizzo email' });
            const ruoloLabel = RUOLO_LABEL[c.ruolo] || c.ruolo;
            await (0, email_1.inviaEmail)({
                to: c.email,
                subject: `Abbraccio — completa la tua iscrizione: dati mancanti`,
                html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
          <h2 style="color:#1e4d8c;margin-top:0;">Completa la tua iscrizione</h2>
          <p>Ciao ${c.nome},</p>
          <p>grazie per la tua iscrizione come <strong>${ruoloLabel}</strong> alla rete Abbraccio Cure Domiciliari. Per valutare la tua candidatura ci mancano ancora questi dati:</p>
          <ul style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 14px 14px 34px;line-height:1.8;">
            ${campi.map((f) => `<li>${f}</li>`).join('')}
          </ul>
          <p>Puoi rispondere <strong>direttamente a questa email</strong> con i dati mancanti — per il documento basta allegare una foto o un PDF.</p>
          <p style="color:#64748b;font-size:13px;">Grazie,<br><strong>Abbraccio Cure Domiciliari</strong><br>Tel. 06 01905242</p>
        </div>`,
                log: { tipo: 'richiesta_dati', area: 'intermediazione', riferimento: `${c.nome} ${c.cognome}` },
            });
        }
        c.richiesteDati = [...(c.richiesteDati || []), { at: new Date(), campi, canale }];
        await c.save();
        return res.json({ message: canale === 'email' ? `Email di richiesta inviata a ${c.email}` : 'Richiesta registrata' });
    }
    catch (error) {
        console.error('[Candidati intermediazione] Errore richiesta dati:', error);
        return res.status(500).json({ message: 'Errore invio richiesta dati', error: error.message });
    }
});
router.patch('/:id/accetta', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), (0, audit_1.auditLog)('candidati_intermediazione', 'UPDATE'), async (req, res) => {
    try {
        const c = await CandidatoIntermediazione_1.default.findById(req.params.id);
        if (!c)
            return res.status(404).json({ message: 'Candidato non trovato' });
        if (c.stato === 'accettato')
            return res.status(400).json({ message: 'Candidato già accettato' });
        const emailStaff = c.email || `candidato.${String(c._id)}@intermediazione.local`;
        const esistente = await Staff_1.default.findOne({ email: emailStaff });
        if (esistente) {
            const stessaPersona = (esistente.firstName || '').toLowerCase().trim() === c.nome.toLowerCase().trim() &&
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
            c.staffId = esistente._id;
            if (req.body?.nota)
                c.noteAdmin = s(req.body.nota);
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
        const staff = await Staff_1.default.create({
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
        c.staffId = staff._id;
        if (req.body?.nota)
            c.noteAdmin = s(req.body.nota);
        await c.save();
        return res.json({ message: `${c.nome} ${c.cognome} accettato/a — ora in Personale Intermediazioni`, staffId: staff._id });
    }
    catch (error) {
        console.error('[Candidati intermediazione] Errore accettazione:', error);
        if (error?.code === 11000 && error?.keyPattern?.email) {
            return res.status(409).json({ message: `Email già presente nel personale: ${error.keyValue?.email}. Verifica con "Richiedi dati" o rifiuta.` });
        }
        return res.status(500).json({ message: 'Errore accettazione', error: error.message });
    }
});
router.patch('/:id/rifiuta', auth_1.authenticateToken, (0, roles_1.authorizeRole)(...RUOLI_GESTIONE), (0, audit_1.auditLog)('candidati_intermediazione', 'UPDATE'), async (req, res) => {
    try {
        const c = await CandidatoIntermediazione_1.default.findById(req.params.id);
        if (!c)
            return res.status(404).json({ message: 'Candidato non trovato' });
        c.stato = 'rifiutato';
        if (req.body?.nota)
            c.noteAdmin = s(req.body.nota);
        await c.save();
        return res.json({ message: 'Candidatura rifiutata' });
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore rifiuto', error });
    }
});
router.delete('/:id', auth_1.authenticateToken, (0, roles_1.authorizeRole)('admin'), (0, audit_1.auditLog)('candidati_intermediazione', 'DELETE'), async (req, res) => {
    try {
        await CandidatoIntermediazione_1.default.findByIdAndDelete(req.params.id);
        return res.json({ message: 'Candidatura eliminata' });
    }
    catch (error) {
        return res.status(500).json({ message: 'Errore eliminazione', error });
    }
});
export default router;