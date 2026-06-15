import { Router, Request, Response } from 'express';
import RichiestaRegistrazionePaziente from '../models/RichiestaRegistrazionePaziente';
import Patient from '../models/Patient';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { inviaEmailNotificaAdmin } from '../utils/email';

const router = Router();

// ═══════════════════════════════════════════════════════════
// POST /api/richieste-paziente — pubblica, senza login
// ═══════════════════════════════════════════════════════════
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      firstName, lastName, birthDate, codiceFiscale,
      address, contactPhone, email,
      assistanceNeeds, medicoReferente, noteAggiuntive,
      diagnosiAmmissione, comorbilita, allergie,
      richiedenteNome, richiedenteRelazione, richiedenteEmail, richiedenteTelefono,
    } = req.body;

    if (!firstName || !lastName || !birthDate || !address || !assistanceNeeds || !richiedenteNome) {
      return res.status(400).json({ message: 'Campi obbligatori mancanti: nome, cognome, data nascita, indirizzo, necessità, nome richiedente' });
    }

    const richiesta = await RichiestaRegistrazionePaziente.create({
      firstName, lastName, birthDate: new Date(birthDate), codiceFiscale,
      address, contactPhone, email,
      assistanceNeeds, medicoReferente, noteAggiuntive,
      diagnosiAmmissione, comorbilita, allergie,
      richiedenteNome, richiedenteRelazione, richiedenteEmail, richiedenteTelefono,
      stato: 'in_attesa',
    });

    // Notifica admin
    try {
      await inviaEmailNotificaAdmin(
        `${firstName} ${lastName}`,
        richiedenteEmail || 'noreply@abbracciocure.it',
        'Nuova registrazione paziente'
      );
    } catch (e) {
      console.warn('⚠️ Notifica admin fallita:', e);
    }

    return res.status(201).json({ message: 'Richiesta inviata con successo', id: richiesta._id });
  } catch (err: any) {
    return res.status(500).json({ message: 'Errore nella creazione richiesta', error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/richieste-paziente — solo admin/coordinator
// ═══════════════════════════════════════════════════════════
router.get('/', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const { stato } = req.query;
    const filter: any = stato ? { stato } : {};
    const richieste = await RichiestaRegistrazionePaziente.find(filter).sort({ createdAt: -1 });
    return res.json(richieste);
  } catch (err: any) {
    return res.status(500).json({ message: 'Errore nel recupero richieste', error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /api/richieste-paziente/:id/approva — crea Patient
// ═══════════════════════════════════════════════════════════
router.put('/:id/approva', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const richiesta = await RichiestaRegistrazionePaziente.findById(req.params.id);
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    if (richiesta.stato === 'approvata') return res.status(400).json({ message: 'Richiesta già approvata' });

    const { noteAdmin } = req.body;

    // Crea il paziente
    const paziente = await Patient.create({
      firstName: richiesta.firstName,
      lastName: richiesta.lastName,
      birthDate: richiesta.birthDate,
      address: richiesta.address,
      contactPhone: richiesta.contactPhone,
      email: richiesta.email,
      codiceFiscale: richiesta.codiceFiscale,
      assistanceNeeds: richiesta.assistanceNeeds,
      diagnosiAmmissione: richiesta.diagnosiAmmissione,
      comorbilita: richiesta.comorbilita,
      allergie: richiesta.allergie,
      caregiverRiferimento: richiesta.richiedenteNome,
      caregiverTelefono: richiesta.richiedenteTelefono,
      tipoGestione: 'privato',
    });

    richiesta.stato = 'approvata';
    richiesta.noteAdmin = noteAdmin;
    richiesta.pazienteCreatId = String(paziente._id);
    await richiesta.save();

    return res.json({ message: 'Paziente creato con successo', pazienteId: paziente._id, paziente });
  } catch (err: any) {
    return res.status(500).json({ message: 'Errore nell\'approvazione', error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /api/richieste-paziente/:id/rifiuta
// ═══════════════════════════════════════════════════════════
router.put('/:id/rifiuta', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const richiesta = await RichiestaRegistrazionePaziente.findById(req.params.id);
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });

    richiesta.stato = 'rifiutata';
    richiesta.noteAdmin = req.body.noteAdmin;
    await richiesta.save();

    return res.json({ message: 'Richiesta rifiutata' });
  } catch (err: any) {
    return res.status(500).json({ message: 'Errore nel rifiuto', error: err?.message });
  }
});

// ═══════════════════════════════════════════════════════════
// DELETE /api/richieste-paziente/:id — cancella richiesta
// ═══════════════════════════════════════════════════════════
router.delete('/:id', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const richiesta = await RichiestaRegistrazionePaziente.findById(req.params.id);
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });

    // Non permettere la cancellazione se è già stata approvata
    if (richiesta.stato === 'approvata') {
      return res.status(400).json({ message: 'Non è possibile cancellare una richiesta già approvata' });
    }

    await RichiestaRegistrazionePaziente.findByIdAndDelete(req.params.id);

    return res.json({ message: 'Richiesta cancellata con successo' });
  } catch (err: any) {
    return res.status(500).json({ message: 'Errore nella cancellazione', error: err?.message });
  }
});

export default router;
