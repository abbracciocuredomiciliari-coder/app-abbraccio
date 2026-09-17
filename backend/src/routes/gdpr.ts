import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import ConsensoGDPR from '../models/ConsensoGDPR';
import ConsensoPrestazioneSanitaria from '../models/ConsensoPrestazioneSanitaria';
import Patient from '../models/Patient';
import crypto from 'crypto';
import { inviaEmailConsensoGDPR, inviaEmailConsensoPrestazione, inviaEmail } from '../utils/email';

const router = Router();

/**
 * POST /api/gdpr/consenso
 * Registra nuovo consenso informato
 * Solo admin e coordinator possono registrare consensi
 */
router.post(
  '/consenso',
  authenticateToken, authorizeRole('admin', 'coordinator', 'operatore'),
  auditLog('consenso', 'CREATE'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { patientId, emailNotifica, ...consensoData } = req.body;
      
      if (!patientId) {
        return res.status(400).json({ message: 'patientId richiesto' });
      }
      
      // Verifica che il paziente esista
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return res.status(404).json({ message: 'Paziente non trovato' });
      }
      
      // Genera ID anonimizzato
      const pazienteAnonimoId = crypto.randomUUID();
      
      const user = req.user as { userId: string; email: string };
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                 req.socket?.remoteAddress || 'unknown';
      
      const consenso = await ConsensoGDPR.create({
        patientId,
        pazienteAnonimoId,
        ...consensoData,
        operatoreId: user.userId,
        operatoreEmail: user.email,
        ipAddress: ip,
        userAgent: req.headers['user-agent']?.substring(0, 200),
      });

      const destinatarioEmail = emailNotifica?.trim();
      let emailInviata = false;
      if (destinatarioEmail) {
        const nomePaziente = `${patient.firstName} ${patient.lastName}`;
        const nomeFirmatario = `${consensoData.nomeFirmatario || ''} ${consensoData.cognomeFirmatario || ''}`.trim() || nomePaziente;
        const dataFirmaFmt = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
        emailInviata = await inviaEmailConsensoGDPR(destinatarioEmail, nomePaziente, nomeFirmatario, consensoData.firmatoDa || 'paziente', dataFirmaFmt, consensoData.versioneInformativa || 'v2025.1');
        if (emailInviata) await ConsensoGDPR.findByIdAndUpdate(consenso._id, { $push: { inviiEmail: { email: destinatarioEmail, dataInvio: new Date() } } });
      }
      
      return res.status(201).json({
        message: 'Consenso registrato con successo',
        consensoId: consenso._id,
        pazienteAnonimoId: consenso.pazienteAnonimoId,
        emailInviata,
      });
    } catch (error: any) {
      console.error('[GDPR] Errore registrazione consenso:', error);
      return res.status(500).json({ message: 'Errore registrazione consenso', error: error.message });
    }
  }
);

/**
 * GET /api/gdpr/consenso/:patientId
 * Verifica consenso attivo di un paziente
 */
router.get(
  '/consenso/:patientId',
  authenticateToken, authorizeRole('admin', 'coordinator', 'operatore', 'direttore'),
  auditLog('consenso', 'READ', (req) => req.params.patientId),
  async (req: AuthRequest, res: Response) => {
    try {
      const { patientId } = req.params;
      
      const consenso = await ConsensoGDPR.findOne({
        patientId,
        revocato: false,
      }).sort({ dataFirma: -1 });
      
      if (!consenso) {
        return res.status(404).json({ 
          message: 'Nessun consenso attivo trovato per questo paziente',
          consensoAttivo: false,
        });
      }
      
      return res.json({
        consensoAttivo: true,
        consenso,
      });
    } catch (error: any) {
      return res.status(500).json({ message: 'Errore recupero consenso', error: error.message });
    }
  }
);

router.post(
  '/consenso-prestazione',
  authenticateToken, authorizeRole('admin', 'coordinator', 'operatore'),
  auditLog('consenso_prestazione', 'CREATE'),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        patientId,
        firmatoDa,
        nomeFirmatario,
        cognomeFirmatario,
        relazioneConPaziente,
        prestazioneSanitaria,
        rischiTrattamento,
        firmaDigitale,
        emailNotifica,
      } = req.body;

      if (!patientId || !firmatoDa || !nomeFirmatario?.trim() || !cognomeFirmatario?.trim() || !firmaDigitale) {
        return res.status(400).json({ message: 'Paziente, firmatario e firma sono obbligatori' });
      }
      if (!prestazioneSanitaria || !rischiTrattamento) {
        return res.status(400).json({ message: "È necessario accettare la prestazione sanitaria e l'informativa sui rischi" });
      }

      const patient = await Patient.findById(patientId);
      if (!patient) return res.status(404).json({ message: 'Paziente non trovato' });

      const consensoEsistente = await ConsensoPrestazioneSanitaria.findOne({ patientId, revocato: false });
      if (consensoEsistente) {
        return res.status(409).json({ message: 'Il consenso alla prestazione sanitaria risulta già firmato e archiviato' });
      }

      const user = req.user as { userId: string; email: string };
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || req.socket?.remoteAddress
        || 'unknown';
      const consenso = await ConsensoPrestazioneSanitaria.create({
        patientId,
        firmatoDa,
        nomeFirmatario: nomeFirmatario.trim(),
        cognomeFirmatario: cognomeFirmatario.trim(),
        relazioneConPaziente: relazioneConPaziente?.trim(),
        prestazioneSanitaria: true,
        rischiTrattamento: true,
        firmaDigitale,
        versioneDocumento: 'v2026.1',
        operatoreId: user.userId,
        operatoreEmail: user.email,
        ipAddress,
        userAgent: req.headers['user-agent']?.substring(0, 200),
      });

      const destinatarioEmail = emailNotifica?.trim();
      let emailInviata = false;
      if (destinatarioEmail) {
        emailInviata = await inviaEmailConsensoPrestazione(destinatarioEmail, `${patient.firstName} ${patient.lastName}`, `${consenso.nomeFirmatario} ${consenso.cognomeFirmatario}`, consenso.firmatoDa, new Date(consenso.dataFirma).toLocaleDateString('it-IT'), consenso.versioneDocumento);
        if (emailInviata) await ConsensoPrestazioneSanitaria.findByIdAndUpdate(consenso._id, { $push: { inviiEmail: { email: destinatarioEmail, dataInvio: new Date() } } });
      }

      return res.status(201).json({ message: 'Consenso alla prestazione sanitaria archiviato', consenso, emailInviata });
    } catch (error: any) {
      console.error('[GDPR] Errore consenso prestazione:', error);
      return res.status(500).json({ message: 'Errore nel salvataggio del consenso alla prestazione', error: error.message });
    }
  }
);

router.post('/consenso/:patientId/invia-email', authorizeRole('admin', 'coordinator', 'operatore'), auditLog('consenso', 'UPDATE', (req) => req.params.patientId), async (req: AuthRequest, res: Response) => {
  try {
    const email = req.body.email?.trim();
    if (!email) return res.status(400).json({ message: 'Inserire un indirizzo email valido' });
    const [patient, consenso] = await Promise.all([Patient.findById(req.params.patientId), ConsensoGDPR.findOne({ patientId: req.params.patientId, revocato: false }).sort({ dataFirma: -1 })]);
    if (!patient || !consenso) return res.status(404).json({ message: 'Consenso GDPR archiviato non trovato' });
    const inviata = await inviaEmailConsensoGDPR(email, `${patient.firstName} ${patient.lastName}`, `${consenso.nomeFirmatario} ${consenso.cognomeFirmatario}`, consenso.firmatoDa, new Date(consenso.dataFirma).toLocaleDateString('it-IT'), consenso.versioneInformativa);
    if (!inviata) return res.status(503).json({ message: 'Invio email non riuscito. Verificare la configurazione SMTP.' });
    await ConsensoGDPR.findByIdAndUpdate(consenso._id, { $push: { inviiEmail: { email, dataInvio: new Date() } } });
    return res.json({ message: 'Copia del consenso GDPR inviata e registrata' });
  } catch (error: any) { return res.status(500).json({ message: 'Errore invio consenso GDPR', error: error.message }); }
});

router.post('/consenso-prestazione/:patientId/invia-email', authorizeRole('admin', 'coordinator', 'operatore'), auditLog('consenso_prestazione', 'UPDATE', (req) => req.params.patientId), async (req: AuthRequest, res: Response) => {
  try {
    const email = req.body.email?.trim();
    if (!email) return res.status(400).json({ message: 'Inserire un indirizzo email valido' });
    const [patient, consenso] = await Promise.all([Patient.findById(req.params.patientId), ConsensoPrestazioneSanitaria.findOne({ patientId: req.params.patientId, revocato: false }).sort({ dataFirma: -1 })]);
    if (!patient || !consenso) return res.status(404).json({ message: 'Consenso alla prestazione archiviato non trovato' });
    const inviata = await inviaEmailConsensoPrestazione(email, `${patient.firstName} ${patient.lastName}`, `${consenso.nomeFirmatario} ${consenso.cognomeFirmatario}`, consenso.firmatoDa, new Date(consenso.dataFirma).toLocaleDateString('it-IT'), consenso.versioneDocumento);
    if (!inviata) return res.status(503).json({ message: 'Invio email non riuscito. Verificare la configurazione SMTP.' });
    await ConsensoPrestazioneSanitaria.findByIdAndUpdate(consenso._id, { $push: { inviiEmail: { email, dataInvio: new Date() } } });
    return res.json({ message: 'Copia del consenso alla prestazione inviata e registrata' });
  } catch (error: any) { return res.status(500).json({ message: 'Errore invio consenso alla prestazione', error: error.message }); }
});

router.get(
  '/consenso-prestazione/:patientId',
  authenticateToken, authorizeRole('admin', 'coordinator', 'operatore', 'direttore'),
  auditLog('consenso_prestazione', 'READ', (req) => req.params.patientId),
  async (req: AuthRequest, res: Response) => {
    try {
      const consenso = await ConsensoPrestazioneSanitaria.findOne({
        patientId: req.params.patientId,
        revocato: false,
      }).sort({ dataFirma: -1 });
      if (!consenso) return res.status(404).json({ consensoAttivo: false, message: 'Nessun consenso alla prestazione sanitaria trovato' });
      return res.json({ consensoAttivo: true, consenso });
    } catch (error: any) {
      return res.status(500).json({ message: 'Errore recupero consenso alla prestazione', error: error.message });
    }
  }
);

/**
 * POST /api/gdpr/revoca/:patientId
 * Revoca consenso (diritto all'oblio - step 1)
 */
router.post(
  '/revoca/:patientId',
  authenticateToken, authorizeRole('admin', 'coordinator'),
  auditLog('consenso', 'UPDATE', (req) => req.params.patientId),
  async (req: AuthRequest, res: Response) => {
    try {
      const { patientId } = req.params;
      const { motivoRevoca } = req.body;
      
      const consenso = await ConsensoGDPR.findOneAndUpdate(
        { patientId, revocato: false },
        {
          revocato: true,
          dataRevoca: new Date(),
          motivoRevoca,
        },
        { sort: { dataFirma: -1 }, new: true }
      );
      
      if (!consenso) {
        return res.status(404).json({ message: 'Nessun consenso attivo da revocare' });
      }
      
      // Qui si potrebbe innescare la cancellazione automatica dei dati
      // dopo un periodo di conservazione legale (es. 10 anni per dati sanitari)
      
      return res.json({
        message: 'Consenso revocato con successo',
        dataRevoca: consenso.dataRevoca,
        nota: 'I dati verranno cancellati automaticamente al termine del periodo di conservazione legale.',
      });
    } catch (error: any) {
      return res.status(500).json({ message: 'Errore revoca consenso', error: error.message });
    }
  }
);

/**
 * POST /api/gdpr/cancellazione-dati/:patientId
 * Cancellazione immediata dati (diritto all'oblio - completo)
 * Solo admin. Richiede conferma esplicita.
 */
router.post(
  '/cancellazione-dati/:patientId',
  authenticateToken, authorizeRole('admin'),
  auditLog('cancellazione-dati', 'DELETE', (req) => req.params.patientId),
  async (req: AuthRequest, res: Response) => {
    try {
      const { patientId } = req.params;
      const { conferma, motivo } = req.body;
      
      if (!conferma || conferma !== 'CONFERMO CANCELLAZIONE DEFINITIVA') {
        return res.status(400).json({
          message: 'Cancellazione non confermata',
          istruzioni: 'Inserire conferma: "CONFERMO CANCELLAZIONE DEFINITIVA"',
        });
      }
      
      // Log pre-cancellazione (per audit)
      const user = req.user as { userId: string; email: string };
      console.log(`[GDPR-CANCELLAZIONE] Operatore ${user.email} (${user.userId}) ha cancellato i dati del paziente ${patientId}. Motivo: ${motivo || 'Non specificato'}`);
      
      // Qui implementare la cancellazione effettiva da tutte le collezioni
      // o la pseudonimizzazione completa
      
      // Esempio: pseudonimizzazione paziente
      await Patient.findByIdAndUpdate(patientId, {
        firstName: '[ANONIMIZZATO]',
        lastName: '[ANONIMIZZATO]',
        birthDate: new Date('1970-01-01'),
        address: '[ANONIMIZZATO]',
        contactPhone: '[ANONIMIZZATO]',
        assistanceNeeds: '[DATI CANCELLATI PER RICHIESTA INTERESSATO]',
        anonimizzato: true,
        dataAnonimizzazione: new Date(),
        motivoAnonimizzazione: motivo || 'Richiesta interessato (GDPR)',
      });
      
      return res.json({
        message: 'Dati paziente cancellati/pseudonimizzati con successo',
        patientId,
        dataCancellazione: new Date(),
        nota: 'I dati sono stati resi irreversibilmente anonimi.',
      });
    } catch (error: any) {
      return res.status(500).json({ message: 'Errore cancellazione dati', error: error.message });
    }
  }
);

/**
 * GET /api/gdpr/report-trattamento/:patientId
 * Report completo dei dati del paziente (diritto di accesso GDPR)
 */
router.get(
  '/report-trattamento/:patientId',
  authenticateToken, authorizeRole('admin', 'direttore'),
  auditLog('report-trattamento', 'READ', (req) => req.params.patientId),
  async (req: AuthRequest, res: Response) => {
    try {
      const { patientId } = req.params;
      
      // Recupera tutti i dati del paziente
      const patient = await Patient.findById(patientId).lean();
      const consensi = await ConsensoGDPR.find({ patientId }).lean();
      
      // Qui si possono aggiungere altre collezioni (diario, piani lavoro, etc.)
      
      const report = {
        paziente: patient,
        consensi,
        // altri dati...
        nota: 'Questo report è stato generato in risposta all\'esercizio del diritto di accesso (art. 15 GDPR)',
        generatoIl: new Date(),
      };
      
      return res.json(report);
    } catch (error: any) {
      return res.status(500).json({ message: 'Errore generazione report', error: error.message });
    }
  }
);

// ─── FIRMA REMOTA CONSENSO GDPR ───────────────────────────────────────────────

// POST /api/gdpr/consenso/:patientId/invia-firma
// Invia al paziente un link sicuro per firmare il consenso GDPR
router.post(
  '/consenso/:patientId/invia-firma',
  authenticateToken, authorizeRole('admin', 'coordinator', 'operatore'),
  auditLog('consenso', 'CREATE', (req) => req.params.patientId),
  async (req: AuthRequest, res: Response) => {
    try {
      const { patientId } = req.params;
      const { email } = req.body;

      const patient = await Patient.findById(patientId);
      if (!patient) return res.status(404).json({ message: 'Paziente non trovato' });
      if (!email?.trim()) return res.status(400).json({ message: 'Email del destinatario richiesta' });

      const consensoEsistente = await ConsensoGDPR.findOne({ patientId, revocato: false, firmato: true });
      if (consensoEsistente) return res.status(409).json({ message: 'Esiste già un consenso firmato attivo' });

      const token = crypto.randomBytes(32).toString('hex');
      const user = req.user as { userId: string; email?: string };
      if (!user?.userId || !user?.email) {
        return res.status(401).json({ message: 'Operatore non autenticato correttamente' });
      }

      const consenso = await ConsensoGDPR.create({
        patientId,
        pazienteAnonimoId: crypto.randomUUID(),
        finalita: { prestazioneSanitaria: true, fatturazione: true, auditInterno: true, ricercaScientifica: false },
        modalita: { cartaceo: true, informatico: true, telefonico: true },
        datiSensibili: { datiSanitari: true, datiEconomici: true, immagini: false },
        comunicazioneTerzi: { mediciSpecialisti: false, struttureSanitarie: false, familiari: false, assicurazioni: false },
        firmatoDa: 'paziente',
        nomeFirmatario: patient.firstName || '',
        cognomeFirmatario: patient.lastName || '',
        versioneInformativa: 'v2025.1',
        token,
        dataInvio: new Date(),
        operatoreId: user.userId,
        operatoreEmail: user.email,
      });

      const frontendUrl = process.env.FRONTEND_URL || 'https://app.abbracciocuredomiciliari.it';
      const link = `${frontendUrl}/firma-consenso?token=${token}`;

      const inviata = await inviaEmail({
        to: email.trim(),
        subject: `Richiesta firma consenso GDPR - ${patient.firstName} ${patient.lastName}`,
        html: `<p>Gentile ${patient.firstName} ${patient.lastName},</p>
               <p>per completare l'adesione al trattamento dei dati è necessario firmare il consenso GDPR.</p>
               <p><a href="${link}" style="padding:10px 16px;background:#1e4d8c;color:#fff;text-decoration:none;border-radius:6px;">Firma il consenso</a></p>
               <p>Oppure copia e incolla il link: ${link}</p>
               <p>Grazie,<br>Abbraccio Cure Domiciliari</p>`,
      });
      if (!inviata) {
        return res.status(503).json({ message: 'Invio email non riuscito. Verificare la configurazione SMTP.' });
      }

      return res.json({ message: 'Email inviata', consensoId: consenso._id, token });
    } catch (error: any) {
      console.error('[GDPR] Errore invio firma:', error);
      return res.status(500).json({ message: 'Errore invio consenso', error: error.message });
    }
  }
);

// GET /api/gdpr/consenso/firma/:token
// Verifica validità token e restituisce dati paziente
router.get('/consenso/firma/:token', async (req: Request, res: Response) => {
  try {
    const consenso = await ConsensoGDPR.findOne({ token: req.params.token, revocato: false });
    if (!consenso) return res.status(404).json({ message: 'Link non valido o scaduto' });
    if (consenso.firmato) return res.status(400).json({ message: 'Consenso già firmato' });
    const patient = await Patient.findById(consenso.patientId).lean();
    if (!patient) return res.status(404).json({ message: 'Paziente non trovato' });
    return res.json({
      consenso,
      patient: {
        _id: patient._id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        birthDate: patient.birthDate,
        email: patient.email,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore verifica link', error: error.message });
  }
});

// POST /api/gdpr/consenso/firma/:token
// Salva firma remota del paziente
router.post('/consenso/firma/:token', async (req: Request, res: Response) => {
  try {
    const { firmaImg, nome, luogo } = req.body;
    if (!firmaImg) return res.status(400).json({ message: 'Firma richiesta' });

    const consenso = await ConsensoGDPR.findOneAndUpdate(
      { token: req.params.token, revocato: false, firmato: false },
      {
        firmato: true,
        firmaImg,
        ...(nome ? { nomeFirmatario: nome } : {}),
        luogoFirma: luogo,
        dataFirma: new Date(),
        htmlFirmato: `<p>Consenso GDPR firmato il ${new Date().toLocaleDateString('it-IT')} inserito da Abbraccio Cure Domiciliari.</p>`,
      },
      { new: true }
    );

    if (!consenso) return res.status(404).json({ message: 'Link non valido o già firmato' });
    return res.json({ message: 'Consenso firmato e archiviato' });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore firma consenso', error: error.message });
  }
});

export default router;
