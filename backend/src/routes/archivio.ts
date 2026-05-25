import { Router, Request, Response } from 'express';
import ArchivioCartella from '../models/ArchivioCartella';
import WorkPlan from '../models/WorkPlan';
import WorkPlanAccess from '../models/WorkPlanAccess';
import DiarioClinico from '../models/DiarioClinico';
import AllegatoCartella from '../models/AllegatoCartella';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// POST /api/archivio/:workPlanId - Archivia un piano di lavoro (snapshot completo)
router.post('/:workPlanId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { workPlanId } = req.params;
    const { note } = req.body;
    const user = (req as any).user;

    // Solo admin e coordinator possono archiviare
    if (user.role !== 'admin' && user.role !== 'coordinator') {
      return res.status(403).json({ message: 'Solo admin e coordinatori possono archiviare le cartelle' });
    }

    // Controlla se già archiviato
    const esistente = await ArchivioCartella.findOne({ workPlanId });
    if (esistente) {
      return res.status(400).json({ message: 'Questo piano di lavoro è già stato archiviato', archivio: esistente });
    }

    // Carica il piano di lavoro con paziente e operatore
    const workplan = await WorkPlan.findById(workPlanId)
      .populate('patient', 'firstName lastName codiceFiscale dataNascita address')
      .populate('staff', 'firstName lastName role');

    if (!workplan) {
      return res.status(404).json({ message: 'Piano di lavoro non trovato' });
    }

    const paziente = workplan.patient as any;
    const operatore = workplan.staff as any;

    // Carica tutti gli accessi
    const accessi = await WorkPlanAccess.find({ workPlan: workPlanId }).sort({ oraEntrata: 1 });

    // Carica tutto il diario clinico
    const diario = await DiarioClinico.find({ workPlan: workPlanId }).sort({ dataRegistrazione: 1 });

    // Carica tutti gli allegati
    const allegati = await AllegatoCartella.find({ workPlan: workPlanId }).sort({ dataCaricamento: 1 });

    // Crea lo snapshot
    const archivio = await ArchivioCartella.create({
      workPlanId: workplan._id,
      patientId: paziente._id,

      paziente: {
        firstName: paziente.firstName,
        lastName: paziente.lastName,
        codiceFiscale: paziente.codiceFiscale,
        dataNascita: paziente.dataNascita,
        address: paziente.address,
      },

      workPlan: {
        type: workplan.type,
        category: workplan.category,
        task: workplan.task,
        date: workplan.date?.toISOString(),
        dataFine: workplan.dataFine?.toISOString(),
        status: workplan.status,
        notes: workplan.notes,
      },

      operatore: {
        firstName: operatore.firstName,
        lastName: operatore.lastName,
        role: operatore.role,
      },

      accessi: accessi.map(a => ({
        staffName: a.staffName,
        staffRole: a.staffRole,
        oraEntrata: a.oraEntrata,
        oraUscita: a.oraUscita,
        durataMinuti: (a as any).durataMinuti || 0,
        note: a.note,
        firmaLogin: a.firmaLogin,
      })),

      diario: diario.map(d => ({
        dataRegistrazione: d.dataRegistrazione,
        staffName: d.staffName,
        firmaLogin: d.firmaLogin,
        testo: d.testo,
        firmato: d.firmato,
        dataFirma: d.dataFirma,
        parametriVitali: d.parametriVitali,
      })),

      allegati: allegati.map(a => ({
        nomeFile: a.nomeFile,
        mimeType: a.mimeType,
        dimensione: a.dimensione,
        descrizione: a.descrizione,
        caricatoDa: a.caricatoDa,
        dataCaricamento: a.dataCaricamento,
        urlCloudinary: a.urlCloudinary,
      })),

      dataArchiviazione: new Date(),
      archiviatoDa: user.name || user.email || 'Sistema',
      note: note?.trim(),
    });

    return res.status(201).json({
      message: 'Cartella clinica archiviata con successo',
      archivio,
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore durante l\'archiviazione', error: error?.message });
  }
});

// GET /api/archivio - Lista di tutte le cartelle archiviate
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paziente } = req.query;

    // Solo admin, coordinator e direttore possono vedere l'archivio
    if (user.role !== 'admin' && user.role !== 'coordinator' && user.role !== 'direttore') {
      return res.status(403).json({ message: 'Accesso non autorizzato all\'archivio' });
    }

    let filter: any = {};
    if (paziente) {
      const term = (paziente as string).toLowerCase();
      // Ricerca per nome/cognome paziente
      filter.$or = [
        { 'paziente.firstName': { $regex: term, $options: 'i' } },
        { 'paziente.lastName': { $regex: term, $options: 'i' } },
      ];
    }

    const archivi = await ArchivioCartella.find(filter)
      .select('-diario -accessi -allegati') // Escludi i dettagli per la lista
      .sort({ dataArchiviazione: -1 });

    return res.json(archivi);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel recupero dell\'archivio', error: error?.message });
  }
});

// GET /api/archivio/:id - Dettaglio completo di una cartella archiviata
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (user.role !== 'admin' && user.role !== 'coordinator' && user.role !== 'direttore') {
      return res.status(403).json({ message: 'Accesso non autorizzato all\'archivio' });
    }

    const archivio = await ArchivioCartella.findById(req.params.id);
    if (!archivio) {
      return res.status(404).json({ message: 'Cartella archiviata non trovata' });
    }

    return res.json(archivio);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel recupero della cartella', error: error?.message });
  }
});

// DELETE /api/archivio/:id - Elimina una cartella archiviata (solo admin e direttore)
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Solo admin e direttore possono eliminare dall'archivio
    if (user.role !== 'admin' && user.role !== 'direttore') {
      return res.status(403).json({ message: 'Solo admin e direttore sanitario possono eliminare cartelle dall\'archivio' });
    }

    const archivio = await ArchivioCartella.findByIdAndDelete(req.params.id);
    if (!archivio) {
      return res.status(404).json({ message: 'Cartella archiviata non trovata' });
    }

    return res.json({ message: 'Cartella eliminata dall\'archivio con successo' });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nell\'eliminazione della cartella', error: error?.message });
  }
});

export default router;
