import { Router, Request, Response } from 'express';
import RichiestaPrenotazione from '../models/RichiestaPrenotazione';
import Prelievo from '../models/Prelievo';
import EsameStrumentale from '../models/EsameStrumentale';
import WorkPlan from '../models/WorkPlan';
import Patient from '../models/Patient';
import Staff from '../models/Staff';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { inviaEmailNuovaRichiestaPrenotazione, inviaEmailConfermaPrenotazione } from '../utils/email';

const router = Router();

// Helper per notifiche admin
async function notificaAdminNuovaRichiesta(richiesta: any) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'abbracciocuredomiciliari@gmail.com';
    await inviaEmailNuovaRichiestaPrenotazione(adminEmail, richiesta);
  } catch (err) {
    console.warn('⚠️ Errore notifica admin:', err);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/richieste-prenotazioni/pubblica - Richiesta pubblica (senza login)
// ═════════════════════════════════════════════════════════════════════════════
router.post('/pubblica', async (req: Request, res: Response) => {
  try {
    const {
      richiedenteNome,
      richiedenteEmail,
      richiedenteTelefono,
      pazienteNome,
      pazienteIndirizzo,
      pazienteTelefono,
      tipoServizio,
      tipoSpecifico,
      dataPreferita,
      orarioPreferito,
      dataAlternativa,
      orarioAlternativo,
      priorita,
      noteRichiedente,
    } = req.body;

    if (!pazienteNome || !pazienteIndirizzo || !tipoServizio || !dataPreferita || !richiedenteNome) {
      return res.status(400).json({ message: 'Campi obbligatori: nome richiedente, nome paziente, indirizzo, tipo servizio, data preferita' });
    }

    const richiesta = await RichiestaPrenotazione.create({
      richiedenteNome,
      richiedenteEmail,
      richiedenteTelefono,
      pazienteNome,
      pazienteIndirizzo,
      pazienteTelefono,
      tipoServizio,
      tipoSpecifico,
      dataPreferita: new Date(dataPreferita),
      orarioPreferito,
      dataAlternativa: dataAlternativa ? new Date(dataAlternativa) : undefined,
      orarioAlternativo,
      priorita: priorita || 'normale',
      noteRichiedente,
      stato: 'in_attesa',
      storicoModifiche: [{
        data: new Date(),
        autore: richiedenteNome,
        azione: 'Richiesta pubblica creata',
        note: `Servizio: ${tipoServizio}${tipoSpecifico ? ` - ${tipoSpecifico}` : ''}`,
      }],
    });

    // Notifica admin (non blocca se fallisce)
    try {
      await notificaAdminNuovaRichiesta(richiesta);
    } catch (emailError) {
      console.error('Errore invio notifica email:', emailError);
    }

    return res.status(201).json({ message: 'Richiesta inviata con successo', id: richiesta._id });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella creazione richiesta', error: error?.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/richieste-prenotazioni - Crea nuova richiesta (caregiver/paziente)
// ═════════════════════════════════════════════════════════════════════════════
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Solo utenti con ruolo paziente_registrato o admin/coordinator possono creare richieste
    if (!['paziente_registrato', 'admin', 'coordinator'].includes(user.role)) {
      return res.status(403).json({ message: 'Non autorizzato a creare richieste' });
    }

    const {
      pazienteId,
      pazienteNome,
      pazienteIndirizzo,
      pazienteTelefono,
      tipoServizio,
      tipoSpecifico,
      dataPreferita,
      orarioPreferito,
      dataAlternativa,
      orarioAlternativo,
      priorita,
      noteRichiedente
    } = req.body;

    if (!pazienteNome || !pazienteIndirizzo || !tipoServizio || !dataPreferita) {
      return res.status(400).json({ message: 'Campi obbligatori: pazienteNome, pazienteIndirizzo, tipoServizio, dataPreferita' });
    }

    const richiesta = await RichiestaPrenotazione.create({
      richiedenteUserId: user.userId,
      richiedenteNome: user.name,
      richiedenteEmail: user.email,
      richiedenteTelefono: user.telefono,
      pazienteId,
      pazienteNome,
      pazienteIndirizzo,
      pazienteTelefono,
      tipoServizio,
      tipoSpecifico,
      dataPreferita: new Date(dataPreferita),
      orarioPreferito,
      dataAlternativa: dataAlternativa ? new Date(dataAlternativa) : undefined,
      orarioAlternativo,
      priorita: priorita || 'normale',
      noteRichiedente,
      stato: 'in_attesa',
      storicoModifiche: [{
        data: new Date(),
        autore: user.name,
        azione: 'Richiesta creata',
        note: `Servizio: ${tipoServizio}${tipoSpecifico ? ` - ${tipoSpecifico}` : ''}`
      }]
    });

    // Notifica admin
    await notificaAdminNuovaRichiesta(richiesta);

    return res.status(201).json(richiesta);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella creazione richiesta', error: error?.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/richieste-prenotazioni/mie - Richieste del caregiver loggato
// ═════════════════════════════════════════════════════════════════════════════
router.get('/mie', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Solo paziente_registrato vede le proprie richieste
    if (user.role !== 'paziente_registrato' && !['admin', 'coordinator'].includes(user.role)) {
      return res.status(403).json({ message: 'Non autorizzato' });
    }

    const richieste = await RichiestaPrenotazione.find({ richiedenteUserId: user.userId })
      .sort({ createdAt: -1 });

    return res.json(richieste);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel recupero richieste', error: error?.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/richieste-prenotazioni - Tutte le richieste (admin/coordinator)
// ═════════════════════════════════════════════════════════════════════════════
router.get('/', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const { stato, tipoServizio, from, to } = req.query;
    let filter: any = {};

    if (stato) filter.stato = stato;
    if (tipoServizio) filter.tipoServizio = tipoServizio;
    if (from || to) {
      filter.dataPreferita = {};
      if (from) filter.dataPreferita.$gte = new Date(from as string);
      if (to) filter.dataPreferita.$lte = new Date(to as string);
    }

    const richieste = await RichiestaPrenotazione.find(filter)
      .populate('pazienteId', 'firstName lastName')
      .populate('staffAssegnatoId', 'firstName lastName')
      .sort({ priorita: -1, createdAt: -1 });

    return res.json(richieste);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel recupero richieste', error: error?.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/richieste-prenotazioni/:id - Dettaglio richiesta
// ═════════════════════════════════════════════════════════════════════════════
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const richiesta = await RichiestaPrenotazione.findById(req.params.id)
      .populate('pazienteId', 'firstName lastName')
      .populate('staffAssegnatoId', 'firstName lastName')
      .populate('prelievoId')
      .populate('esameStrumentaleId')
      .populate('workPlanId');

    if (!richiesta) {
      return res.status(404).json({ message: 'Richiesta non trovata' });
    }

    // Solo il richiedente, admin o coordinator possono vedere
    if (richiesta.richiedenteUserId.toString() !== user.userId &&
        !['admin', 'coordinator'].includes(user.role)) {
      return res.status(403).json({ message: 'Non autorizzato' });
    }

    return res.json(richiesta);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel recupero richiesta', error: error?.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// PATCH /api/richieste-prenotazioni/:id/gestisci - Admin gestisce richiesta
// ═════════════════════════════════════════════════════════════════════════════
router.patch('/:id/gestisci', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const {
      stato,
      dataConfermata,
      orarioConfermato,
      staffAssegnatoId,
      staffAssegnatoNome,
      noteAdmin,
      creaAppuntamento
    } = req.body;

    const richiesta = await RichiestaPrenotazione.findById(id);
    if (!richiesta) {
      return res.status(404).json({ message: 'Richiesta non trovata' });
    }

    // Aggiorna richiesta
    if (stato) richiesta.stato = stato;
    if (dataConfermata) richiesta.dataConfermata = new Date(dataConfermata);
    if (orarioConfermato) richiesta.orarioConfermato = orarioConfermato;
    if (staffAssegnatoId) {
      richiesta.staffAssegnatoId = staffAssegnatoId;
      // Auto-populate staffAssegnatoNome if not provided
      if (!staffAssegnatoNome) {
        try {
          const staffMember = await Staff.findById(staffAssegnatoId);
          if (staffMember) {
            richiesta.staffAssegnatoNome = `${staffMember.firstName} ${staffMember.lastName}`;
          }
        } catch { /* ignore lookup errors */ }
      } else {
        richiesta.staffAssegnatoNome = staffAssegnatoNome;
      }
    }
    if (noteAdmin !== undefined) richiesta.noteAdmin = noteAdmin;

    // Aggiungi a storico
    richiesta.storicoModifiche.push({
      data: new Date(),
      autore: user.name || user.email,
      azione: `Stato: ${stato}`,
      note: noteAdmin || (dataConfermata ? `Data confermata: ${dataConfermata}` : undefined)
    });

    // Se confermata, crea l'appuntamento corrispondente
    if (creaAppuntamento && stato === 'confermata') {
      let pazienteId = richiesta.pazienteId;

      // Se paziente non esiste, crealo
      if (!pazienteId) {
        const nameParts = (richiesta.pazienteNome || '').trim().split(' ');
        const nuovoPaziente = await Patient.create({
          firstName: nameParts[0] || 'N/A',
          lastName: nameParts.slice(1).join(' ') || 'N/A',
          birthDate: new Date('1900-01-01'), // placeholder — da aggiornare in anagrafica
          address: richiesta.pazienteIndirizzo || 'N/A',
          contactPhone: richiesta.pazienteTelefono || richiesta.richiedenteTelefono || '',
          tipoGestione: 'privato',
          assistanceNeeds: `Richiesta ${richiesta.tipoServizio}: ${richiesta.tipoSpecifico || 'N/A'}`
        });
        pazienteId = nuovoPaziente._id;
        richiesta.pazienteId = pazienteId;
      }

      // Crea appuntamento in base al tipo
      const staffRef = staffAssegnatoId || undefined; // avoid empty string for ObjectId fields
      const dataAppuntamento = richiesta.dataConfermata || richiesta.dataPreferita || new Date();

      if (richiesta.tipoServizio === 'prelievo') {
        const prelievo = await Prelievo.create({
          patient: pazienteId,
          staff: staffRef || null,
          dataPrelievo: dataAppuntamento,
          orario: richiesta.orarioConfermato || richiesta.orarioPreferito,
          tipoPrelievo: richiesta.tipoSpecifico || 'Prelievo richiesto',
          note: richiesta.noteRichiedente,
          tipoGestione: 'privato',
          status: 'pianificato'
        });
        richiesta.prelievoId = prelievo._id;
      } else if (richiesta.tipoServizio === 'esame_strumentale') {
        const esameData: any = {
          patient: pazienteId,
          tipoEsame: richiesta.tipoSpecifico || 'Esame richiesto',
          dataEsame: dataAppuntamento,
          orario: richiesta.orarioConfermato || richiesta.orarioPreferito,
          note: richiesta.noteRichiedente,
          status: 'pianificato'
        };
        if (staffRef) esameData.staff = staffRef;
        const esame = await EsameStrumentale.create(esameData);
        richiesta.esameStrumentaleId = esame._id;
      } else if (richiesta.tipoServizio === 'prestazione' || richiesta.tipoServizio === 'assistenza') {
        const workplan = await WorkPlan.create({
          type: richiesta.tipoServizio === 'assistenza' ? 'assistenziale' : 'prestazionale',
          category: richiesta.tipoSpecifico || 'Prestazione richiesta',
          patient: pazienteId,
          staff: staffRef || undefined,
          date: dataAppuntamento,
          time: richiesta.orarioConfermato || richiesta.orarioPreferito,
          task: richiesta.tipoSpecifico || `${richiesta.tipoServizio} richiesta`,
          notes: richiesta.noteRichiedente,
          status: 'pending'
        });
        richiesta.workPlanId = workplan._id;
      }

      // Invia email conferma al richiedente (solo se email presente)
      if (richiesta.richiedenteEmail) {
        try {
          await inviaEmailConfermaPrenotazione(richiesta.richiedenteEmail, richiesta);
        } catch (emailErr) {
          console.warn('⚠️ Errore invio email conferma:', emailErr);
        }
      }
    }

    await richiesta.save();
    return res.json(richiesta);
  } catch (error: any) {
    console.error('❌ Errore gestisci richiesta:', error?.message, error?.errors);
    return res.status(500).json({ message: 'Errore nella gestione richiesta', error: error?.message, details: error?.errors });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/richieste-prenotazioni/:id - Elimina richiesta (admin/coordinator per qualsiasi stato)
// ═════════════════════════════════════════════════════════════════════════════
router.delete('/:id', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const richiesta = await RichiestaPrenotazione.findById(req.params.id);
    if (!richiesta) {
      return res.status(404).json({ message: 'Richiesta non trovata' });
    }

    // Permetti eliminazione di tutte le richieste indipendentemente dal stato
    // Utile per pulire richieste confermate che non hanno liberato lo slot

    await RichiestaPrenotazione.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Richiesta eliminata' });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nell\'eliminazione', error: error?.message });
  }
});

export default router;
