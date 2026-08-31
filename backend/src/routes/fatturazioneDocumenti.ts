import { Router, Request, Response } from 'express';
import DocumentoFatturazione from '../models/DocumentoFatturazione';
import Patient from '../models/Patient';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';

const router = Router();

const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];

// ─── Numerazione progressiva per tipo + anno ───────────────────────────────────
async function generaNumero(tipo: 'preventivo' | 'fattura'): Promise<string> {
  const anno = new Date().getFullYear();
  const prefisso = tipo === 'preventivo' ? 'PREV' : 'FATT';
  const count = await DocumentoFatturazione.countDocuments({
    tipo,
    numero: { $regex: `^${prefisso}-${anno}-` },
  });
  const progressivo = String(count + 1).padStart(5, '0');
  return `${prefisso}-${anno}-${progressivo}`;
}

// GET /api/fatturazione-documenti — lista (filtro per paziente opzionale)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { patient, tipo } = req.query;
    const filtro: any = {};
    if (patient) filtro.patient = patient;
    if (tipo) filtro.tipo = tipo;
    const documenti = await DocumentoFatturazione.find(filtro)
      .populate('patient', 'firstName lastName codiceFiscale address')
      .sort({ data: -1 });
    return res.json(documenti);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel caricamento dei documenti', error: error.message });
  }
});

// GET /api/fatturazione-documenti/:id — dettaglio singolo documento
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const doc = await DocumentoFatturazione.findById(req.params.id).populate('patient', 'firstName lastName codiceFiscale address');
    if (!doc) return res.status(404).json({ message: 'Documento non trovato' });
    return res.json(doc);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel caricamento del documento', error: error.message });
  }
});

// POST /api/fatturazione-documenti — crea un preventivo o una fattura (solo gestione)
router.post('/', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('fatturazione_documenti', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const { tipo, patient, prestazioni, riferimentoTipo, riferimentoId, note } = req.body;

    if (!tipo || !['preventivo', 'fattura'].includes(tipo)) {
      return res.status(400).json({ message: "Il campo 'tipo' deve essere 'preventivo' o 'fattura'" });
    }
    if (!patient) return res.status(400).json({ message: 'Paziente obbligatorio' });
    if (!Array.isArray(prestazioni) || prestazioni.length === 0) {
      return res.status(400).json({ message: 'Specificare almeno una prestazione' });
    }

    const pazienteEsiste = await Patient.findById(patient);
    if (!pazienteEsiste) return res.status(404).json({ message: 'Paziente non trovato' });

    const prestazioniNormalizzate = prestazioni.map((p: any) => {
      const quantita = Number(p.quantita) > 0 ? Number(p.quantita) : 1;
      const prezzoUnitario = Number(p.prezzoUnitario) || 0;
      return {
        descrizione: String(p.descrizione || '').trim(),
        quantita,
        prezzoUnitario,
        importo: Math.round(quantita * prezzoUnitario * 100) / 100,
      };
    }).filter((p: any) => p.descrizione);

    if (prestazioniNormalizzate.length === 0) {
      return res.status(400).json({ message: 'Le prestazioni indicate non sono valide' });
    }

    const totale = Math.round(prestazioniNormalizzate.reduce((acc: number, p: any) => acc + p.importo, 0) * 100) / 100;
    const numero = await generaNumero(tipo);
    const user = req.user as { name?: string; email?: string } | undefined;

    const doc = await DocumentoFatturazione.create({
      numero,
      tipo,
      patient,
      riferimentoTipo,
      riferimentoId: riferimentoId || undefined,
      prestazioni: prestazioniNormalizzate,
      totale,
      data: new Date(),
      stato: 'emesso',
      note,
      creatoDa: user?.name || user?.email || 'Sistema',
    });

    const docPopolato = await DocumentoFatturazione.findById(doc._id).populate('patient', 'firstName lastName codiceFiscale address');
    return res.status(201).json(docPopolato);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella creazione del documento', error: error.message });
  }
});

// POST /api/fatturazione-documenti/:id/converti-in-fattura — genera una fattura a partire da un preventivo accettato
router.post('/:id/converti-in-fattura', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('fatturazione_documenti', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const preventivo = await DocumentoFatturazione.findById(req.params.id);
    if (!preventivo) return res.status(404).json({ message: 'Preventivo non trovato' });
    if (preventivo.tipo !== 'preventivo') return res.status(400).json({ message: 'Il documento indicato non è un preventivo' });

    const numero = await generaNumero('fattura');
    const user = req.user as { name?: string; email?: string } | undefined;

    const fattura = await DocumentoFatturazione.create({
      numero,
      tipo: 'fattura',
      patient: preventivo.patient,
      riferimentoTipo: preventivo.riferimentoTipo,
      riferimentoId: preventivo.riferimentoId,
      prestazioni: preventivo.prestazioni,
      totale: preventivo.totale,
      data: new Date(),
      stato: 'emesso',
      note: preventivo.note,
      creatoDa: user?.name || user?.email || 'Sistema',
      documentoOrigineId: preventivo._id,
    });

    const fatturaPopolata = await DocumentoFatturazione.findById(fattura._id).populate('patient', 'firstName lastName codiceFiscale address');
    return res.status(201).json(fatturaPopolata);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella conversione in fattura', error: error.message });
  }
});

// PATCH /api/fatturazione-documenti/:id/annulla — annulla un documento (solo gestione)
router.patch('/:id/annulla', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('fatturazione_documenti', 'UPDATE'), async (req: Request, res: Response) => {
  try {
    const doc = await DocumentoFatturazione.findByIdAndUpdate(req.params.id, { stato: 'annullato' }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Documento non trovato' });
    return res.json(doc);
  } catch (error: any) {
    return res.status(500).json({ message: "Errore nell'annullamento del documento", error: error.message });
  }
});

export default router;
