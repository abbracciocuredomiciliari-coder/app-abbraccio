import { Router, Request, Response } from 'express';
import WorkPlan from '../models/WorkPlan';
import WorkPlanAccess from '../models/WorkPlanAccess';
import Staff from '../models/Staff';
import User from '../models/User';
import { authenticateToken } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { inviaEmailNuovoPianoDiLavoro } from '../utils/email';
import { getStaffByUser } from '../utils/staffHelper';

const router = Router();

// Ruoli operativi (non admin/coordinator/direttore)
const RUOLI_OPERATORI = ['caregiver', 'infermiere', 'oss', 'fisioterapista'];
function isOperatore(role: string) {
  return !['admin', 'coordinator', 'direttore'].includes(role);
}


// GET / — lista piani (operatore vede solo i propri, admin/coordinator vedono tutti)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = ['admin', 'coordinator', 'direttore'].includes(user.role);
    const { tipo, status, page, limit } = req.query;

    let filter: any = {};

    if (!isPrivileged) {
      const staffMember = await getStaffByUser(user.id || user.userId, user.email);
      if (staffMember) {
        filter.staff = staffMember._id;
      } else {
        return res.json([]);
      }
    }

    // Filtro per status (pending/completed/cancelled)
    if (status && ['pending', 'completed', 'cancelled'].includes(status as string)) {
      filter.status = status;
    }

    const query = WorkPlan.find(filter)
      .populate('patient', 'firstName lastName tipoGestione')
      .populate('staff', 'firstName lastName role category active')
      .populate('prestazioni.staff', 'firstName lastName role category')
      .sort({ date: 1 });

    // Paginazione opzionale — retrocompatibile
    if (page !== undefined && limit !== undefined) {
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 50));
      const skip = (pageNum - 1) * limitNum;
      const [workplans, total] = await Promise.all([
        query.skip(skip).limit(limitNum),
        WorkPlan.countDocuments(filter),
      ]);
      // Filtro tipo gestione post-populate
      const data = (tipo === 'privato' || tipo === 'convenzione')
        ? workplans.filter((wp: any) => (wp.patient as any)?.tipoGestione === tipo)
        : workplans;
      return res.json({ data, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) });
    }

    const workplans = await query;
    // Filtro opzionale per tipo gestione (privato/convenzione)
    if (tipo === 'privato' || tipo === 'convenzione') {
      return res.json(workplans.filter((wp: any) => (wp.patient as any)?.tipoGestione === tipo));
    }
    return res.json(workplans);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero del piano di lavoro', error });
  }
});

// GET /miei-pazienti — pazienti assegnati all'operatore loggato (o tutti se privilegiato)
router.get('/miei-pazienti', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = ['admin', 'coordinator', 'direttore'].includes(user.role);

    let filter: any = { status: { $ne: 'cancelled' } };

    if (!isPrivileged) {
      const staffMember = await getStaffByUser(user.id || user.userId, user.email);
      if (!staffMember) return res.json([]);
      filter.staff = staffMember._id;
    } else {
      // Privilegiato: se ha un profilo staff mostra solo i suoi piani assegnati nel portale operatore
      // altrimenti (nessun profilo staff) mostra tutti i piani attivi
      const staffMember = await getStaffByUser(user.id || user.userId, user.email);
      if (staffMember) {
        filter.staff = staffMember._id;
      }
      // se staffMember è null → nessun filtro staff → vede tutti i pazienti
    }

    const piani = await WorkPlan.find(filter)
      .populate('patient', 'firstName lastName birthDate address contactPhone assistanceNeeds tipoGestione siat')
      .sort({ date: -1 });

    // Deduplica pazienti
    const pazientiMap = new Map();
    for (const piano of piani) {
      const p = piano.patient as any;
      if (p && !pazientiMap.has(p._id.toString())) {
        pazientiMap.set(p._id.toString(), {
          ...p.toJSON(),
          pianiAssegnati: piani.filter(pl => (pl.patient as any)?._id?.toString() === p._id.toString()).length,
        });
      }
    }

    return res.json(Array.from(pazientiMap.values()));
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dei pazienti assegnati', error });
  }
});

// GET /mio-profilo-staff — profilo Staff dell'operatore loggato
router.get('/mio-profilo-staff', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const staffMember = await getStaffByUser(user.id || user.userId, user.email);
    if (!staffMember) {
      return res.status(404).json({ message: 'Profilo staff non trovato' });
    }
    return res.json(staffMember);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero del profilo staff', error });
  }
});

router.patch('/mio-profilo-staff', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user.id || user.userId;
    const staffMember = await getStaffByUser(userId, user.email);
    if (!staffMember) return res.status(404).json({ message: 'Profilo staff non trovato' });

    const firstName = String(req.body.firstName || '').trim();
    const lastName = String(req.body.lastName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    if (!firstName || !lastName || !email) return res.status(400).json({ message: 'Nome, cognome ed email sono obbligatori' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Inserisci un indirizzo email valido' });

    const account = await User.findById(userId);
    if (!account) return res.status(404).json({ message: 'Account utente non trovato' });
    const [emailUserEsistente, emailStaffEsistente] = await Promise.all([
      User.findOne({ email, _id: { $ne: account._id } }),
      Staff.findOne({ email, _id: { $ne: staffMember._id } }),
    ]);
    if (emailUserEsistente || emailStaffEsistente) return res.status(409).json({ message: 'Questa email è già utilizzata da un altro account' });

    account.firstName = firstName;
    account.lastName = lastName;
    account.name = `${firstName} ${lastName}`;
    account.email = email;
    account.phone = phone;
    account.telefono = phone;
    staffMember.firstName = firstName;
    staffMember.lastName = lastName;
    staffMember.email = email;
    staffMember.phone = phone;
    await Promise.all([account.save(), staffMember.save()]);

    return res.json({ message: 'Dati personali aggiornati. Al prossimo accesso usa la nuova email.', staff: staffMember });
  } catch (error: any) {
    if (error?.code === 11000) return res.status(409).json({ message: 'Questa email è già utilizzata da un altro account' });
    return res.status(500).json({ message: 'Errore nell\'aggiornamento del profilo', error: error?.message });
  }
});

router.get('/assignment-status', authenticateToken, authorizeRole('admin', 'coordinator', 'direttore'), async (_req: Request, res: Response) => {
  try {
    const assignments = await WorkPlan.find({ status: 'pending' })
      .populate('patient', 'firstName lastName')
      .populate('staff', 'firstName lastName role email')
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    const counts = assignments.reduce((result: Record<string, number>, assignment: any) => {
      const status = assignment.statoAccettazione || 'in_attesa';
      result[status] = (result[status] || 0) + 1;
      return result;
    }, { in_attesa: 0, accettato: 0, rifiutato: 0 });
    return res.json({ counts, assignments });
  } catch (error: any) { return res.status(500).json({ message: 'Errore recupero stato assegnazioni', error: error.message }); }
});

// Create new workplan item
router.post('/', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const body = req.body;
    // Se vengono passate prestazioni[] e non uno staff principale, usa il primo operatore delle prestazioni
    if (body.prestazioni?.length > 0 && !body.staff) {
      body.staff = body.prestazioni[0].staff;
    }
    const workplan = await WorkPlan.create({
      ...body,
      statoAccettazione: body.staff ? 'in_attesa' : undefined,
      storicoAssegnazioni: body.staff ? [{ staff: body.staff, stato: 'assegnato', data: new Date() }] : [],
    });

    // Invia email notifica all'operatore assegnato
    try {
      const populated = await WorkPlan.findById(workplan._id)
        .populate('patient', 'firstName lastName')
        .populate('staff', 'firstName lastName email')
        .populate('prestazioni.staff', 'firstName lastName email');

      if (populated) {
        const staffDoc = populated.staff as any;
        const patientDoc = populated.patient as any;
        // Notifica tutti gli operatori delle prestazioni (se diversi dallo staff principale)
        const staffEmails = new Set<string>();
        if (staffDoc?.email) staffEmails.add(staffDoc.email);
        (populated as any).prestazioni?.forEach((p: any) => { if (p.staff?.email) staffEmails.add(p.staff.email); });
        if (staffDoc?.email) {
          const nomePaziente = `${patientDoc?.firstName || ''} ${patientDoc?.lastName || ''}`.trim();
          const dataInizio = new Date(workplan.date).toLocaleDateString('it-IT');
          await inviaEmailNuovoPianoDiLavoro(
            staffDoc.email,
            `${staffDoc.firstName} ${staffDoc.lastName}`,
            nomePaziente,
            dataInizio,
            workplan.task,
            workplan._id.toString()
          );
        }
      }
    } catch (emailErr) {
      console.warn('⚠️ Errore invio email notifica piano:', emailErr);
    }

    return res.status(201).json(workplan);
  } catch (error: any) {
    console.error('❌ Errore creazione workplan:', error);
    return res.status(400).json({ message: 'Errore nella creazione dell incarico', error: error.message, details: error.errors });
  }
});

// Update workplan item
router.patch('/:id', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Recupera piano originale per verificare se cambia operatore
    const originale = await WorkPlan.findById(id).populate('patient', 'firstName lastName');
    const staffPrecedente = originale?.staff?.toString();

    const workplan = await WorkPlan.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
      .populate('patient', 'firstName lastName')
      .populate('staff', 'firstName lastName role email');

    if (!workplan) {
      return res.status(404).json({ message: 'Incarico non trovato' });
    }

    // Invia email se lo staff è stato cambiato/assegna nuovo operatore
    if (updates.staff && updates.staff !== staffPrecedente) {
      try {
        const staffDoc = (workplan as any).staff;
        const patientDoc = (workplan as any).patient;
        if (staffDoc?.email) {
          const nomePaziente = `${patientDoc?.firstName || ''} ${patientDoc?.lastName || ''}`.trim();
          const dataInizio = new Date(workplan.date).toLocaleDateString('it-IT');
          await inviaEmailNuovoPianoDiLavoro(
            staffDoc.email,
            `${staffDoc.firstName} ${staffDoc.lastName}`,
            nomePaziente,
            dataInizio,
            workplan.task,
            workplan._id.toString()
          );
        }
      } catch (emailErr) {
        console.warn('⚠️ Errore invio email riassegnazione piano:', emailErr);
      }
    }

    return res.json(workplan);
  } catch (error) {
    return res.status(400).json({ message: 'Errore nell aggiornamento dell incarico', error });
  }
});

// Delete workplan item
router.delete('/:id', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workplan = await WorkPlan.findByIdAndDelete(id);
    if (!workplan) {
      return res.status(404).json({ message: 'Incarico non trovato' });
    }
    return res.json({ message: 'Incarico eliminato con successo' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell eliminazione dell incarico', error });
  }
});

// GET /api/workplan/:id/accessi - Storico accessi per un incarico
router.get('/:id/accessi', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const workplan = await WorkPlan.findById(id)
      .populate('patient', 'firstName lastName')
      .populate('staff', 'firstName lastName role');

    if (!workplan) {
      return res.status(404).json({ message: 'Incarico non trovato' });
    }

    // Verifica che l'operatore possa vedere questo piano
    if (isOperatore(user.role)) {
      const staffMember = await getStaffByUser(user.id || user.userId, user.email);
      if (!staffMember) {
        return res.status(403).json({ message: 'Non autorizzato: profilo staff non trovato' });
      }
      const staffId = (workplan.staff as any)?._id
        ? (workplan.staff as any)._id.toString()
        : workplan.staff?.toString();
      if (staffId !== staffMember._id.toString()) {
        return res.status(403).json({ message: 'Non autorizzato a vedere questo piano' });
      }
    }

    const accessi = await WorkPlanAccess.find({ workPlan: id }).sort({ oraEntrata: -1 });

    // Calcola ore totali lavorate
    let minutiTotali = 0;
    for (const acc of accessi) {
      if (acc.oraUscita) {
        minutiTotali += Math.round((acc.oraUscita.getTime() - acc.oraEntrata.getTime()) / 60000);
      }
    }
    const oreTotali = minutiTotali / 60;

    // Calcola compenso in base al tipo
    let compensoCalcolato = 0;
    const accessiCompletati = accessi.filter(a => a.oraUscita);
    if (workplan.tipoCompenso === 'orario' && workplan.tariffa) {
      compensoCalcolato = Math.round(oreTotali * workplan.tariffa * 100) / 100;
    } else if (workplan.tipoCompenso === 'fisso' && workplan.tariffa) {
      compensoCalcolato = Math.round(accessiCompletati.length * workplan.tariffa * 100) / 100;
    }

    // Compenso maturato per ogni accesso (per visualizzazione)
    const accessiConCompenso = accessi.map(acc => {
      let compensoAcc = (acc as any).compensoMaturato || 0;
      if (!compensoAcc && acc.oraUscita && workplan.tariffa && workplan.tipoCompenso !== 'nessuno') {
        const minuti = Math.round((acc.oraUscita.getTime() - acc.oraEntrata.getTime()) / 60000);
        if (workplan.tipoCompenso === 'orario') {
          compensoAcc = Math.round((minuti / 60) * workplan.tariffa * 100) / 100;
        } else if (workplan.tipoCompenso === 'fisso') {
          compensoAcc = workplan.tariffa;
        }
      }
      return {
        _id: acc._id,
        staffName: acc.staffName,
        staffRole: acc.staffRole,
        oraEntrata: acc.oraEntrata,
        oraUscita: acc.oraUscita,
        note: acc.note,
        firmaLogin: acc.firmaLogin,
        durataMinuti: (acc as any).durataMinuti || (acc.oraUscita ? Math.round((acc.oraUscita.getTime() - acc.oraEntrata.getTime()) / 60000) : 0),
        compensoMaturato: compensoAcc,
        firmaOperatore: acc.firmaOperatore || null,
        firmaPaziente: acc.firmaPaziente || null,
        nomeFirmatarioPaziente: acc.nomeFirmatarioPaziente || null,
        ruoloFirmatario: acc.ruoloFirmatario || null,
        firmatoAllaPartenza: acc.firmatoAllaPartenza || false,
      };
    });

    return res.json({
      workplan,
      accessi: accessiConCompenso,
      riepilogo: {
        totaleAccessi: accessi.length,
        accessiCompletati: accessiCompletati.length,
        accessiAperti: accessi.filter(a => !a.oraUscita).length,
        minutiTotali,
        oreTotali: Math.round(oreTotali * 100) / 100,
        compensoCalcolato,
        compensoSalvato: workplan.compensoTotale || 0,
        compensoPagato: workplan.compensoPagato || false,
        costoPrestazione: workplan.costoPrestazione || 0,
        utile: Math.round(((workplan.costoPrestazione || 0) - (workplan.compensoTotale || 0)) * 100) / 100,
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero degli accessi', error });
  }
});

// GET /api/workplan/:id/accessi/export — Export accessi per periodo (PDF-ready JSON)
router.get('/:id/accessi/export', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { dataInizio, dataFine } = req.query;
    const user = (req as any).user;

    const workplan = await WorkPlan.findById(id)
      .populate('patient', 'firstName lastName birthDate address')
      .populate('staff', 'firstName lastName role email');

    if (!workplan) {
      return res.status(404).json({ message: 'Incarico non trovato' });
    }

    // Verifica autorizzazione: admin, coordinator, direttore, o l'operatore affidatario
    if (isOperatore(user.role)) {
      const staffMember = await getStaffByUser(user.id || user.userId, user.email);
      if (!staffMember) {
        return res.status(403).json({ message: 'Non autorizzato: profilo staff non trovato' });
      }
      // workplan.staff può essere un oggetto popolato o un ObjectId — estraiamo sempre l'_id
      const staffId = (workplan.staff as any)?._id
        ? (workplan.staff as any)._id.toString()
        : workplan.staff?.toString();
      if (staffId !== staffMember._id.toString()) {
        return res.status(403).json({ message: 'Non autorizzato: questo piano non è assegnato a te' });
      }
    }

    // Filtro per periodo
    const filter: any = { workPlan: id };
    if (dataInizio || dataFine) {
      filter.oraEntrata = {};
      if (dataInizio) filter.oraEntrata.$gte = new Date(dataInizio as string);
      if (dataFine) {
        const fine = new Date(dataFine as string);
        fine.setHours(23, 59, 59, 999);
        filter.oraEntrata.$lte = fine;
      }
    } else {
      // Default: mese corrente
      const ora = new Date();
      filter.oraEntrata = {
        $gte: new Date(ora.getFullYear(), ora.getMonth(), 1),
        $lte: new Date(ora.getFullYear(), ora.getMonth() + 1, 0, 23, 59, 59),
      };
    }

    const accessi = await WorkPlanAccess.find(filter).sort({ oraEntrata: 1 });

    let minutiTotali = 0;
    let compensoTotale = 0;
    const accessiFormattati = accessi.map(acc => {
      const durata = acc.oraUscita
        ? Math.round((acc.oraUscita.getTime() - acc.oraEntrata.getTime()) / 60000)
        : 0;
      minutiTotali += durata;

      let compenso = (acc as any).compensoMaturato || 0;
      if (!compenso && acc.oraUscita && workplan.tariffa && workplan.tipoCompenso !== 'nessuno') {
        if (workplan.tipoCompenso === 'orario') {
          compenso = Math.round((durata / 60) * workplan.tariffa * 100) / 100;
        } else if (workplan.tipoCompenso === 'fisso') {
          compenso = workplan.tariffa;
        }
      }
      compensoTotale += compenso;

      return {
        data: acc.oraEntrata.toLocaleDateString('it-IT'),
        oraEntrata: acc.oraEntrata.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        oraUscita: acc.oraUscita ? acc.oraUscita.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—',
        durataMinuti: durata,
        durataOre: durata > 0 ? `${Math.floor(durata / 60)}h ${durata % 60}m` : '—',
        operatore: acc.staffName,
        ruolo: acc.staffRole,
        note: acc.note || '',
        compenso: compenso > 0 ? `€ ${compenso.toFixed(2)}` : '—',
        firmaOperatore: acc.firmaOperatore || null,
        firmaPaziente: acc.firmaPaziente || null,
        nomeFirmatarioPaziente: acc.nomeFirmatarioPaziente || null,
        ruoloFirmatario: acc.ruoloFirmatario || null,
        firmatoAllaPartenza: acc.firmatoAllaPartenza || false,
      };
    });

    const staffDoc = workplan.staff as any;
    const patientDoc = workplan.patient as any;

    return res.json({
      piano: {
        id: workplan._id,
        paziente: `${patientDoc?.firstName || ''} ${patientDoc?.lastName || ''}`.trim(),
        operatore: `${staffDoc?.firstName || ''} ${staffDoc?.lastName || ''}`.trim(),
        ruoloOperatore: staffDoc?.role || '',
        task: workplan.task,
        dataInizio: workplan.date ? new Date(workplan.date).toLocaleDateString('it-IT') : '',
        dataFine: workplan.dataFine ? new Date(workplan.dataFine).toLocaleDateString('it-IT') : '',
        tipoCompenso: workplan.tipoCompenso || 'nessuno',
        tariffa: workplan.tariffa || 0,
      },
      periodo: {
        da: dataInizio ? new Date(dataInizio as string).toLocaleDateString('it-IT') : `01/${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
        a: dataFine ? new Date(dataFine as string).toLocaleDateString('it-IT') : new Date().toLocaleDateString('it-IT'),
      },
      accessi: accessiFormattati,
      riepilogo: {
        totaleAccessi: accessi.length,
        minutiTotali,
        oreTotali: `${Math.floor(minutiTotali / 60)}h ${minutiTotali % 60}m`,
        compensoTotale: compensoTotale > 0 ? `€ ${compensoTotale.toFixed(2)}` : '—',
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell\'export degli accessi', error });
  }
});

// PATCH /api/workplan/:id/eseguito - Segna esame strumentale come eseguito
router.patch('/:id/eseguito', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { dataEsecuzione, orario, note } = req.body;
    const workplan = await WorkPlan.findById(id);
    if (!workplan) {
      return res.status(404).json({ message: 'Incarico non trovato' });
    }
    if (workplan.type !== 'esami_strumentali') {
      return res.status(400).json({ message: 'Questo endpoint è solo per esami strumentali' });
    }
    workplan.status = 'completed';
    if (dataEsecuzione) workplan.date = new Date(dataEsecuzione);
    if (orario) workplan.time = orario;
    if (note) workplan.notes = note;
    await workplan.save();
    return res.json(workplan);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel segnare l\'esame come eseguito', error: error?.message });
  }
});

// PATCH /api/workplan/:id/compenso - Aggiorna compenso (calcola o imposta manualmente)
router.patch('/:id/compenso', authenticateToken, authorizeRole('admin', 'coordinator'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tipoCompenso, tariffa, compensoTotale, compensoPagato, ricalcola, costoPrestazione } = req.body;

    const workplan = await WorkPlan.findById(id);
    if (!workplan) {
      return res.status(404).json({ message: 'Incarico non trovato' });
    }

    if (tipoCompenso !== undefined) workplan.tipoCompenso = tipoCompenso;
    if (tariffa !== undefined) workplan.tariffa = tariffa;
    if (compensoPagato !== undefined) workplan.compensoPagato = compensoPagato;
    if (costoPrestazione !== undefined) workplan.costoPrestazione = costoPrestazione;

    if (ricalcola || compensoTotale === undefined) {
      const accessi = await WorkPlanAccess.find({ workPlan: id });
      let minutiTotali = 0;
      for (const acc of accessi) {
        if (acc.oraUscita) {
          minutiTotali += Math.round((acc.oraUscita.getTime() - acc.oraEntrata.getTime()) / 60000);
        }
      }
      const oreTotali = minutiTotali / 60;

      if (workplan.tipoCompenso === 'orario' && workplan.tariffa) {
        workplan.compensoTotale = Math.round(oreTotali * workplan.tariffa * 100) / 100;
      } else if (workplan.tipoCompenso === 'fisso' && workplan.tariffa) {
        workplan.compensoTotale = workplan.tariffa;
      }
    } else if (compensoTotale !== undefined) {
      workplan.compensoTotale = compensoTotale;
    }

    await workplan.save();
    return res.json(workplan);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nell\'aggiornamento del compenso', error: error?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workplan/:id/accetta - Operatore accetta incarico
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/accetta', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const workplan = await WorkPlan.findById(id)
      .populate('patient', 'firstName lastName')
      .populate('staff', 'firstName lastName email role');
    if (!workplan) {
      return res.status(404).json({ message: 'Incarico non trovato' });
    }

    // Verifica che sia l'operatore assegnato
    const staffDoc = (workplan as any).staff;
    if (staffDoc?.email !== user.email && staffDoc?._id?.toString() !== user.userId) {
      return res.status(403).json({ message: 'Non autorizzato: incarico assegnato ad altro operatore' });
    }

    workplan.statoAccettazione = 'accettato';
    workplan.dataAccettazione = new Date();
    workplan.storicoAssegnazioni = [...(workplan.storicoAssegnazioni || []), { staff: staffDoc._id, stato: 'accettato', data: new Date() }];
    await workplan.save();

    return res.json({ message: 'Incarico accettato', workplan });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nell\'accettazione', error: error?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workplan/:id/rifiuta - Operatore rifiuta incarico
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/rifiuta', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const user = (req as any).user;

    const workplan = await WorkPlan.findById(id)
      .populate('patient', 'firstName lastName')
      .populate('staff', 'firstName lastName email role');
    if (!workplan) {
      return res.status(404).json({ message: 'Incarico non trovato' });
    }

    // Verifica che sia l'operatore assegnato
    const staffDoc = (workplan as any).staff;
    if (staffDoc?.email !== user.email && staffDoc?._id?.toString() !== user.userId) {
      return res.status(403).json({ message: 'Non autorizzato: incarico assegnato ad altro operatore' });
    }

    const motivoRifiuto = motivo || 'Rifiutato dall\'operatore';
    const excludedStaffIds = (workplan.storicoAssegnazioni || []).map(item => item.staff.toString());
    excludedStaffIds.push(staffDoc._id.toString());
    const candidate = await Staff.findOne({ active: true, role: staffDoc.role, _id: { $nin: excludedStaffIds } }).sort({ updatedAt: 1 });

    workplan.storicoAssegnazioni = [...(workplan.storicoAssegnazioni || []), { staff: staffDoc._id, stato: 'rifiutato', data: new Date(), motivo: motivoRifiuto }];
    workplan.dataAccettazione = new Date();
    workplan.motivoRifiuto = motivoRifiuto;

    if (candidate) {
      workplan.staff = candidate._id as any;
      workplan.statoAccettazione = 'in_attesa';
      workplan.storicoAssegnazioni.push({ staff: candidate._id, stato: 'assegnato', data: new Date() } as any);
      await workplan.save();
      const patient = (workplan as any).patient;
      await inviaEmailNuovoPianoDiLavoro(candidate.email, `${candidate.firstName} ${candidate.lastName}`, `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim(), new Date(workplan.date).toLocaleDateString('it-IT'), workplan.task, workplan._id.toString());
      return res.json({ message: 'Incarico rifiutato e riassegnato automaticamente al prossimo operatore disponibile', workplan, riassegnato: true });
    }

    workplan.statoAccettazione = 'rifiutato';
    await workplan.save();
    return res.json({ message: 'Incarico rifiutato: nessun altro operatore attivo con lo stesso ruolo disponibile', workplan, riassegnato: false });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel rifiuto', error: error?.message });
  }
});

export default router;
