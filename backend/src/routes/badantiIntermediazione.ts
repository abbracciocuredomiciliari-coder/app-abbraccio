import { Router, Request, Response } from 'express';
import BadanteIntermediazione from '../models/BadanteIntermediazione';
import DocumentoFatturazione from '../models/DocumentoFatturazione';
import Patient from '../models/Patient';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';

const router = Router();

const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];

// ─── Numerazione progressiva per preventivi/fatture ────────────────────────────
async function generaNumero(tipo: 'preventivo' | 'fattura'): Promise<string> {
  const anno = new Date().getFullYear();
  const prefisso = tipo === 'preventivo' ? 'PREV' : 'FATT';
  const base = `${prefisso}-${anno}-`;
  const count = await DocumentoFatturazione.countDocuments({
    numero: { $regex: `^${base}` },
  });
  let progressivo = count + 1;
  let numero = `${base}${String(progressivo).padStart(5, '0')}`;
  while (await DocumentoFatturazione.exists({ numero })) {
    progressivo++;
    numero = `${base}${String(progressivo).padStart(5, '0')}`;
  }
  return numero;
}

function normalizzaPrestazioni(prestazioni: any[]) {
  return prestazioni
    .map((p: any) => {
      const quantita = Number(p.quantita) > 0 ? Number(p.quantita) : 1;
      const prezzoUnitario = Number(p.prezzoUnitario) || 0;
      return {
        descrizione: String(p.descrizione || '').trim(),
        quantita,
        prezzoUnitario,
        importo: Math.round(quantita * prezzoUnitario * 100) / 100,
      };
    })
    .filter((p) => p.descrizione);
}

// GET /api/badanti-intermediazione — lista richieste (opzionalmente filtrate per paziente)
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { patient } = req.query;
    const filtro: any = {};
    if (patient) filtro.patient = patient;
    const richieste = await BadanteIntermediazione.find(filtro)
      .populate('patient', 'firstName lastName codiceFiscale email')
      .populate('preventivoId', 'numero stato totale')
      .populate('fatturaId', 'numero stato totale')
      .sort({ createdAt: -1 });
    return res.json(richieste);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel caricamento delle richieste', error: error.message });
  }
});

// GET /api/badanti-intermediazione/:id — dettaglio
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const richiesta = await BadanteIntermediazione.findById(req.params.id)
      .populate('patient', 'firstName lastName codiceFiscale email')
      .populate('preventivoId')
      .populate('fatturaId');
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    return res.json(richiesta);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel caricamento', error: error.message });
  }
});

// POST /api/badanti-intermediazione — crea richiesta
router.post('/', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('badanti_intermediazione', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const { patient, tipoPiano, oreSettimanali, mesiContratto, costoMensile, tariffaOraria, note } = req.body;
    if (!patient) return res.status(400).json({ message: 'Paziente obbligatorio' });
    if (!tipoPiano || !['orario', 'contratto_nazionale'].includes(tipoPiano)) {
      return res.status(400).json({ message: "tipoPiano deve essere 'orario' o 'contratto_nazionale'" });
    }
    const paziente = await Patient.findById(patient);
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });

    const user = req.user as { name?: string; email?: string } | undefined;
    const richiesta = await BadanteIntermediazione.create({
      patient,
      tipoPiano,
      oreSettimanali,
      mesiContratto,
      costoMensile,
      tariffaOraria,
      note,
      creatoDa: user?.name || user?.email || 'Sistema',
    });
    const popolata = await BadanteIntermediazione.findById(richiesta._id).populate('patient', 'firstName lastName codiceFiscale email');
    return res.status(201).json(popolata);
  } catch (error: any) {
    return res.status(500).json({ message: "Errore nella creazione dell'intermediazione", error: error.message });
  }
});

// PUT /api/badanti-intermediazione/:id — aggiorna dati richiesta
router.put('/:id', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('badanti_intermediazione', 'UPDATE'), async (req: AuthRequest, res: Response) => {
  try {
    const richiesta = await BadanteIntermediazione.findById(req.params.id);
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    const { tipoPiano, oreSettimanali, mesiContratto, costoMensile, tariffaOraria, note } = req.body;
    if (tipoPiano) richiesta.tipoPiano = tipoPiano;
    if (oreSettimanali !== undefined) richiesta.oreSettimanali = oreSettimanali;
    if (mesiContratto !== undefined) richiesta.mesiContratto = mesiContratto;
    if (costoMensile !== undefined) richiesta.costoMensile = costoMensile;
    if (tariffaOraria !== undefined) richiesta.tariffaOraria = tariffaOraria;
    if (note !== undefined) richiesta.note = note;
    await richiesta.save();
    const popolata = await BadanteIntermediazione.findById(richiesta._id).populate('patient', 'firstName lastName codiceFiscale email');
    return res.json(popolata);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella modifica', error: error.message });
  }
});

// PATCH /api/badanti-intermediazione/:id/stato — aggiorna stato
router.patch('/:id/stato', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('badanti_intermediazione', 'UPDATE'), async (req: Request, res: Response) => {
  try {
    const { stato } = req.body;
    if (!stato || !['aperta', 'preventivo_emesso', 'accettata', 'fatturata', 'annullata'].includes(stato)) {
      return res.status(400).json({ message: 'Stato non valido' });
    }
    const richiesta = await BadanteIntermediazione.findByIdAndUpdate(req.params.id, { stato }, { new: true })
      .populate('patient', 'firstName lastName codiceFiscale email');
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    return res.json(richiesta);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore modifica stato', error: error.message });
  }
});

// POST /api/badanti-intermediazione/:id/preventivo — genera preventivo
router.post('/:id/preventivo', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('badanti_intermediazione', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const richiesta = await BadanteIntermediazione.findById(req.params.id);
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    if (richiesta.preventivoId) return res.status(400).json({ message: 'Preventivo già generato' });

    const { prestazioni, dataPrestazione, note } = req.body;
    if (!Array.isArray(prestazioni) || prestazioni.length === 0) {
      return res.status(400).json({ message: 'Specificare almeno una voce del preventivo' });
    }
    const prestazioniNormalizzate = normalizzaPrestazioni(prestazioni);
    if (prestazioniNormalizzate.length === 0) {
      return res.status(400).json({ message: 'Le voci indicate non sono valide' });
    }
    const totale = Math.round(prestazioniNormalizzate.reduce((acc, p) => acc + p.importo, 0) * 100) / 100;
    const user = req.user as { name?: string; email?: string } | undefined;
    const numero = await generaNumero('preventivo');

    const preventivo = await DocumentoFatturazione.create({
      numero,
      tipo: 'preventivo',
      patient: richiesta.patient,
      riferimentoTipo: 'badante',
      riferimentoId: richiesta._id,
      prestazioni: prestazioniNormalizzate,
      totale,
      data: new Date(),
      dataPrestazione: dataPrestazione ? new Date(dataPrestazione) : undefined,
      stato: 'emesso',
      note: note || richiesta.note,
      creatoDa: user?.name || user?.email || 'Sistema',
    });

    richiesta.preventivoId = preventivo._id as any;
    richiesta.stato = 'preventivo_emesso';
    await richiesta.save();

    const popolato = await DocumentoFatturazione.findById(preventivo._id).populate('patient', 'firstName lastName codiceFiscale address email');
    return res.status(201).json({ preventivo: popolato, richiesta });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella generazione del preventivo', error: error.message });
  }
});

// POST /api/badanti-intermediazione/:id/fattura — converte preventivo accettato in fattura
router.post('/:id/fattura', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('badanti_intermediazione', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const richiesta = await BadanteIntermediazione.findById(req.params.id);
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    if (!richiesta.preventivoId) return res.status(400).json({ message: 'Preventivo mancante' });
    if (richiesta.fatturaId) return res.status(400).json({ message: 'Fattura già generata' });

    const preventivo = await DocumentoFatturazione.findById(richiesta.preventivoId);
    if (!preventivo) return res.status(404).json({ message: 'Preventivo non trovato' });
    if (preventivo.stato !== 'firmato') return res.status(400).json({ message: 'Il preventivo deve essere firmato prima di emettere fattura' });

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
      dataPrestazione: preventivo.dataPrestazione,
      stato: 'emesso',
      note: preventivo.note,
      creatoDa: user?.name || user?.email || 'Sistema',
      documentoOrigineId: preventivo._id,
      firma: {
        rifiutoRegistro: preventivo.firma?.rifiutoRegistro ?? false,
      },
    });

    richiesta.fatturaId = fattura._id as any;
    richiesta.stato = 'fatturata';
    await richiesta.save();

    const popolata = await DocumentoFatturazione.findById(fattura._id).populate('patient', 'firstName lastName codiceFiscale address email');
    return res.status(201).json({ fattura: popolata, richiesta });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella generazione della fattura', error: error.message });
  }
});

// DELETE /api/badanti-intermediazione/:id
router.delete('/:id', authenticateToken, authorizeRole('admin'), auditLog('badanti_intermediazione', 'DELETE'), async (req: Request, res: Response) => {
  try {
    const richiesta = await BadanteIntermediazione.findByIdAndDelete(req.params.id);
    if (!richiesta) return res.status(404).json({ message: 'Richiesta non trovata' });
    return res.json({ message: 'Richiesta eliminata' });
  } catch (error: any) {
    return res.status(500).json({ message: "Errore nell'eliminazione", error: error.message });
  }
});

export default router;
