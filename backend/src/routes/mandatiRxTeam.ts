import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import MandatoRxTeam from '../models/MandatoRxTeam';
import Patient from '../models/Patient';
import PatientDocument from '../models/PatientDocument';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { inviaEmail } from '../utils/email';
import { decrypt } from '../utils/encryption';
import { generaMandatoRxTeamPDF } from '../utils/mandatoRxTeamPdf';

const router = Router();
const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];

function normalizzaPaziente(raw: any) {
  const p = raw && raw.toJSON ? raw.toJSON() : { ...raw };
  p.address = decrypt(p.address);
  p.contactPhone = decrypt(p.contactPhone);
  p.codiceFiscale = decrypt(p.codiceFiscale);
  return p;
}

function generaNumeroPratica() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `RX-${yyyy}${mm}-${suffix}`;
}

// POST /api/mandati-rx-team — crea un nuovo foglio di accompagnamento / mandato RX Team
router.post('/', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('mandati_rx_team', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      patient, esami, prescrizioneMedica, quesitoClinico, compenso,
      dataEsecuzione, fasciaOraria, referenteRxTeam, recapitoNote,
      accessoInfo, noteOrganizzative, email,
    } = req.body;

    if (!patient) return res.status(400).json({ message: 'Paziente obbligatorio' });
    if (!Array.isArray(esami) || esami.length === 0) return res.status(400).json({ message: 'Seleziona almeno un esame richiesto' });
    if (compenso === undefined || compenso === null || isNaN(Number(compenso))) return res.status(400).json({ message: 'Compenso esame obbligatorio' });

    const paziente = await Patient.findById(patient);
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });

    const operatoreNome = (req.user as any)?.name || '';
    const token = crypto.randomBytes(32).toString('hex');

    const mandato = await MandatoRxTeam.create({
      patient,
      nPratica: generaNumeroPratica(),
      dataRichiesta: new Date(),
      operatoreAbbraccio: operatoreNome,
      esami,
      prescrizioneMedica: prescrizioneMedica || 'non_prevista',
      quesitoClinico: quesitoClinico || '',
      compenso: Number(compenso),
      dataEsecuzione: dataEsecuzione || '',
      fasciaOraria: fasciaOraria || '',
      referenteRxTeam: referenteRxTeam || '',
      recapitoNote: recapitoNote || '',
      accessoInfo: accessoInfo || {},
      noteOrganizzative: noteOrganizzative || '',
      token,
      email: email || paziente.email,
      nome: `${paziente.firstName} ${paziente.lastName}`,
      stato: 'emesso',
    });

    return res.status(201).json(mandato);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella creazione del mandato RX Team', error: error.message });
  }
});

// GET /api/mandati-rx-team — lista per paziente
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { patient } = req.query;
    const query: any = {};
    if (patient) query.patient = patient;
    const mandati = await MandatoRxTeam.find(query).sort({ dataRichiesta: -1 }).populate('patient', 'firstName lastName');
    return res.json(mandati);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel caricamento dei mandati RX Team', error: error.message });
  }
});

// GET /api/mandati-rx-team/:id/pdf — download interno (staff autenticato)
router.get('/:id/pdf', authenticateToken, async (req: Request, res: Response) => {
  try {
    const mandato = await MandatoRxTeam.findById(req.params.id).populate('patient', 'firstName lastName birthDate address contactPhone codiceFiscale email');
    if (!mandato) return res.status(404).json({ message: 'Mandato non trovato' });
    const paziente = normalizzaPaziente(mandato.patient);
    const buffer = await generaMandatoRxTeamPDF(mandato.toObject(), paziente);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="FOGLIO-RX-TEAM-${mandato.nPratica || mandato._id}.pdf"`);
    return res.send(buffer);
  } catch (error: any) {
    console.error('[Mandati RX Team PDF] Errore:', error);
    return res.status(500).json({ message: 'Errore generazione PDF', error: error.message });
  }
});

// POST /api/mandati-rx-team/:id/invia-email — invia link firma al paziente/caregiver
router.post('/:id/invia-email', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('mandati_rx_team', 'UPDATE'), async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email obbligatoria' });

    const mandato = await MandatoRxTeam.findById(req.params.id)
      .populate('patient', 'firstName lastName birthDate address contactPhone codiceFiscale email');
    if (!mandato) return res.status(404).json({ message: 'Mandato non trovato' });
    if (!mandato.token) mandato.token = crypto.randomBytes(32).toString('hex');
    mandato.email = email;
    await mandato.save();

    const pazienteNorm = normalizzaPaziente(mandato.patient);
    const pdfBuffer = await generaMandatoRxTeamPDF(mandato.toObject(), pazienteNorm);

    const frontendUrl = process.env.FRONTEND_URL || 'https://app.abbracciocuredomiciliari.it';
    const apiProtocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const apiHost = req.get('host') || 'api.abbracciocuredomiciliari.it';
    const mandatoPdfUrl = `${apiProtocol}://${apiHost}/api/mandati-rx-team/mandato-pdf/${mandato.token}`;
    const firmaUrl = `${frontendUrl}/firma-mandato-rx-team?token=${mandato.token}`;

    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
      <h2 style="color:#1e4d8c;margin-top:0;">Foglio di accompagnamento RX Team</h2>
      <p>Gentile <strong>${pazienteNorm.firstName || ''} ${pazienteNorm.lastName || ''}</strong>,</p>
      <p>in allegato trovi in formato PDF il foglio di accompagnamento/prenotazione per la prestazione diagnostica domiciliare richiesta tramite <strong>RX Team</strong>, con indicato l'esame richiesto e il relativo compenso.</p>
      <p style="margin:16px 0;padding:16px;background:#f0fdf4;border-left:4px solid #16a34a;border-radius:6px;">
        <strong>Leggi il documento</strong> prima di firmare:<br/>
        <a href="${mandatoPdfUrl}" style="display:inline-block;margin-top:8px;background:#047857;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Scarica foglio RX Team (PDF)</a>
      </p>
      <p style="margin:16px 0;padding:16px;background:#eff6ff;border-left:4px solid #1e4d8c;border-radius:6px;">
        Dopo averlo letto, conferma l'accettazione dell'esame e del compenso, e firma <strong>online con dito o penna</strong>:<br/>
        <a href="${firmaUrl}" style="display:inline-block;margin-top:8px;background:#1e4d8c;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Firma e accetta</a>
      </p>
      <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari S.R.L.S.</p>
    </div>`;

    await inviaEmail({
      to: email,
      subject: `Foglio di accompagnamento RX Team — Abbraccio Cure Domiciliari`,
      html,
      attachments: [
        { filename: `FOGLIO-RX-TEAM-${mandato.nPratica || ''}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
      ],
    });

    return res.json({ message: 'Email di firma inviata' });
  } catch (error: any) {
    console.error('[Mandati RX Team invia email] Errore:', error);
    return res.status(500).json({ message: "Errore nell'invio dell'email", error: error.message });
  }
});

// GET /api/mandati-rx-team/mandato-pdf/:token — download pubblico PDF (via token firma)
router.get('/mandato-pdf/:token', async (req: Request, res: Response) => {
  try {
    const mandato = await MandatoRxTeam.findOne({ token: req.params.token })
      .populate('patient', 'firstName lastName birthDate address contactPhone codiceFiscale email');
    if (!mandato) return res.status(404).json({ message: 'Link non valido' });

    const paziente = normalizzaPaziente(mandato.patient);
    const buffer = await generaMandatoRxTeamPDF(mandato.toObject(), paziente);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="FOGLIO-RX-TEAM-${mandato.nPratica || ''}.pdf"`);
    return res.send(buffer);
  } catch (error: any) {
    console.error('[Mandati RX Team PDF pubblico] Errore:', error);
    return res.status(500).json({ message: 'Errore generazione PDF', error: error.message });
  }
});

// GET /api/mandati-rx-team/firma/:token — verifica link firma (pubblico)
router.get('/firma/:token', async (req: Request, res: Response) => {
  try {
    const mandato = await MandatoRxTeam.findOne({ token: req.params.token })
      .populate('patient', 'firstName lastName birthDate');
    if (!mandato) return res.status(404).json({ message: 'Link non valido' });
    if (mandato.stato === 'firmato') return res.status(400).json({ message: 'Documento già firmato', giaFirmato: true });
    return res.json({
      patient: mandato.patient,
      esami: mandato.esami,
      compenso: mandato.compenso,
      nPratica: mandato.nPratica,
      nome: mandato.nome,
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore verifica link', error: error.message });
  }
});

// POST /api/mandati-rx-team/firma/:token — salva firma di accettazione
router.post('/firma/:token', async (req: Request, res: Response) => {
  try {
    const { firmaImg, nome, luogoFirma, accettato } = req.body;
    if (!accettato) return res.status(400).json({ message: "È obbligatorio accettare l'esame richiesto e il compenso prima di firmare." });
    if (!firmaImg) return res.status(400).json({ message: 'Firma obbligatoria' });

    const mandato = await MandatoRxTeam.findOne({ token: req.params.token });
    if (!mandato) return res.status(404).json({ message: 'Link non valido' });
    if (mandato.stato === 'firmato') return res.status(400).json({ message: 'Documento già firmato' });

    const paziente = await Patient.findById(mandato.patient);
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });

    const nomeFirmatario = nome || `${paziente.firstName} ${paziente.lastName}`;
    const luogo = luogoFirma || 'Roma';
    const dataFirma = new Date();

    mandato.firmaImg = firmaImg;
    mandato.nome = nomeFirmatario;
    mandato.luogoFirma = luogo;
    mandato.dataFirma = dataFirma;
    mandato.stato = 'firmato';
    mandato.accettato = true;
    await mandato.save();

    const pazienteNorm = normalizzaPaziente(paziente);
    const pdfFirmato = await generaMandatoRxTeamPDF(mandato.toObject(), pazienteNorm);

    await PatientDocument.create({
      patient: paziente._id,
      category: 'mandato_rx_team',
      title: `Foglio di accompagnamento RX Team ${mandato.nPratica || ''} — accettato`,
      description: `Accettazione firmata del foglio di accompagnamento RX Team il ${dataFirma.toLocaleDateString('it-IT')}. Compenso pattuito: € ${Number(mandato.compenso).toFixed(2)}.`,
      fileName: `foglio-rx-team-${mandato.nPratica || dataFirma.getTime()}.pdf`,
      contentType: 'application/pdf',
      data: pdfFirmato,
      uploadedByNome: nomeFirmatario,
    });

    return res.json({ message: 'Foglio RX Team firmato e archiviato correttamente' });
  } catch (error: any) {
    console.error('[Mandati RX Team firma] Errore:', error);
    return res.status(500).json({ message: 'Errore salvataggio firma', error: error.message });
  }
});

export default router;
