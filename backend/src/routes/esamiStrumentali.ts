import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import path from 'path';
import fs from 'fs';
import EsameStrumentale from '../models/EsameStrumentale';
import WorkPlan from '../models/WorkPlan';
import Staff from '../models/Staff';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// ─── Configurazione storage (Cloudinary o disco locale) ───────────────────────
const useCloudinary = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const cloudinaryStorage = useCloudinary
  ? new CloudinaryStorage({
      cloudinary,
      params: async (_req: any, file: Express.Multer.File) => {
        let resourceType: 'image' | 'video' | 'raw' = 'raw';
        if (file.mimetype.startsWith('image/')) resourceType = 'image';
        if (file.mimetype === 'application/pdf') resourceType = 'image';
        return {
          folder: 'abbraccio/esami-strumentali',
          resource_type: resourceType,
          format: undefined,
          public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
        };
      },
    } as any)
  : null;

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'esami-strumentali');
if (!useCloudinary && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const localDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Tipo di file non supportato.'));
};

const upload = multer({
  storage: useCloudinary ? (cloudinaryStorage as any) : localDiskStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter,
});

// Helper: trova Staff dell'utente loggato
async function getStaffByUser(userId: string, userEmail?: string) {
  let staff = await Staff.findOne({ userId });
  if (!staff && userEmail) {
    staff = await Staff.findOne({ email: userEmail });
    if (staff) { staff.userId = userId as any; await staff.save(); }
  }
  return staff;
}

function isPrivilegiato(role: string) {
  return ['admin', 'coordinator', 'direttore'].includes(role);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/esami-strumentali
// Lista esami (operatore vede solo i propri, privilegiati vedono tutti)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paziente, stato, archiviati } = req.query;
    let filter: any = {};

    if (!isPrivilegiato(user.role)) {
      const staffMember = await getStaffByUser(user.id || user.userId, user.email);
      if (!staffMember) return res.json([]);
      filter.staff = staffMember._id;
    }

    if (paziente) {
      // Filtra per paziente (ObjectId)
      filter.patient = paziente;
    }

    if (stato) filter.status = stato;

    // Di default non mostrare archiviati
    if (archiviati === 'true') {
      filter.archiviato = true;
    } else if (archiviati !== 'all') {
      filter.archiviato = { $ne: true };
    }

    const esami = await EsameStrumentale.find(filter)
      .populate('patient', 'firstName lastName')
      .populate('staff', 'firstName lastName role')
      .sort({ dataEsame: -1 });

    return res.json(esami);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero degli esami', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/esami-strumentali/:id
// Dettaglio singolo esame
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const esame = await EsameStrumentale.findById(req.params.id)
      .populate('patient', 'firstName lastName birthDate address')
      .populate('staff', 'firstName lastName role');
    if (!esame) return res.status(404).json({ message: 'Esame non trovato' });
    return res.json(esame);
  } catch (error) {
    return res.status(500).json({ message: 'Errore nel recupero dell\'esame', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/esami-strumentali
// Crea un nuovo esame strumentale (collegato a un WorkPlan)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!isPrivilegiato(user.role)) {
      return res.status(403).json({ message: 'Non autorizzato a creare esami strumentali' });
    }

    const { workPlanId, patient, staff, tipoEsame, dataEsame, orario, note } = req.body;

    // Verifica che il WorkPlan esista e sia di tipo esami_strumentali
    if (workPlanId) {
      const wp = await WorkPlan.findById(workPlanId);
      if (!wp) return res.status(404).json({ message: 'Piano di lavoro non trovato' });
    }

    const esame = await EsameStrumentale.create({
      workPlan: workPlanId,
      patient,
      staff,
      tipoEsame,
      dataEsame: new Date(dataEsame),
      orario,
      note,
      status: 'pianificato',
      diaria: [],
      allegati: [],
    });

    const populated = await EsameStrumentale.findById(esame._id)
      .populate('patient', 'firstName lastName')
      .populate('staff', 'firstName lastName role');

    return res.status(201).json(populated);
  } catch (error: any) {
    return res.status(400).json({ message: error?.message || 'Errore nella creazione dell\'esame', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/esami-strumentali/:id
// Aggiorna dati base dell'esame (status, note, orario, ecc.)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const esame = await EsameStrumentale.findById(req.params.id);
    if (!esame) return res.status(404).json({ message: 'Esame non trovato' });

    // Operatori possono solo aggiornare status a 'eseguito'
    if (!isPrivilegiato(user.role)) {
      const staffMember = await getStaffByUser(user.id || user.userId, user.email);
      if (!staffMember || esame.staff.toString() !== staffMember._id.toString()) {
        return res.status(403).json({ message: 'Non autorizzato' });
      }
      // Operatori possono solo segnare come eseguito
      const { status, note } = req.body;
      if (status) esame.status = status;
      if (note !== undefined) esame.note = note;
    } else {
      // Privilegiati possono aggiornare tutto
      const { status, note, orario, dataEsame, tipoEsame } = req.body;
      if (status) esame.status = status;
      if (note !== undefined) esame.note = note;
      if (orario !== undefined) esame.orario = orario;
      if (dataEsame) esame.dataEsame = new Date(dataEsame);
      if (tipoEsame) esame.tipoEsame = tipoEsame;
    }

    await esame.save();
    const populated = await EsameStrumentale.findById(esame._id)
      .populate('patient', 'firstName lastName')
      .populate('staff', 'firstName lastName role');
    return res.json(populated);
  } catch (error: any) {
    return res.status(400).json({ message: error?.message || 'Errore nell\'aggiornamento', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/esami-strumentali/:id
// Elimina un esame (solo admin/coordinator)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'coordinator') {
      return res.status(403).json({ message: 'Non autorizzato' });
    }
    const esame = await EsameStrumentale.findByIdAndDelete(req.params.id);
    if (!esame) return res.status(404).json({ message: 'Esame non trovato' });
    return res.json({ message: 'Esame eliminato' });
  } catch (error) {
    return res.status(500).json({ message: 'Errore nell\'eliminazione', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/esami-strumentali/:id/diaria
// Aggiunge una voce di diaria
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/diaria', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const esame = await EsameStrumentale.findById(req.params.id);
    if (!esame) return res.status(404).json({ message: 'Esame non trovato' });

    const { testo, data } = req.body;
    if (!testo?.trim()) return res.status(400).json({ message: 'Il testo della diaria è obbligatorio' });

    // Determina autore
    let autore = user.name || user.email || 'Operatore';
    let autoreId = user.id || user.userId;
    let ruoloAutore = user.role;

    const staffMember = await getStaffByUser(user.id || user.userId, user.email);
    if (staffMember) {
      autore = `${staffMember.firstName} ${staffMember.lastName}`;
      autoreId = staffMember._id;
      ruoloAutore = staffMember.role;
    }

    const voce = {
      data: data ? new Date(data) : new Date(),
      autore,
      autoreId,
      ruoloAutore,
      testo: testo.trim(),
      firmato: false,
    };

    esame.diaria.push(voce as any);

    // Se l'esame era pianificato, segnalo come eseguito
    if (esame.status === 'pianificato') {
      esame.status = 'eseguito';
    }

    await esame.save();
    return res.status(201).json(esame.diaria[esame.diaria.length - 1]);
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Errore nell\'aggiunta della diaria', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/esami-strumentali/:id/diaria/:diariaId/firma
// Firma una voce di diaria
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/diaria/:diariaId/firma', authenticateToken, async (req: Request, res: Response) => {
  try {
    const esame = await EsameStrumentale.findById(req.params.id);
    if (!esame) return res.status(404).json({ message: 'Esame non trovato' });

    const voce = esame.diaria.find((d: any) => d._id.toString() === req.params.diariaId);
    if (!voce) return res.status(404).json({ message: 'Voce di diaria non trovata' });

    voce.firmato = true;
    voce.dataFirma = new Date();
    await esame.save();
    return res.json(voce);
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Errore nella firma', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/esami-strumentali/:id/diaria/:diariaId
// Elimina una voce di diaria (solo admin/coordinator)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id/diaria/:diariaId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!isPrivilegiato(user.role)) return res.status(403).json({ message: 'Non autorizzato' });

    const esame = await EsameStrumentale.findById(req.params.id);
    if (!esame) return res.status(404).json({ message: 'Esame non trovato' });

    esame.diaria = esame.diaria.filter((d: any) => d._id.toString() !== req.params.diariaId) as any;
    await esame.save();
    return res.json({ message: 'Voce eliminata' });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Errore nell\'eliminazione', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/esami-strumentali/:id/referto
// Salva/aggiorna il referto testuale (solo medico/admin/coordinator/direttore)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id/referto', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    // Solo medico, admin, coordinator, direttore possono refertare
    const ruoliAbilitati = ['admin', 'coordinator', 'direttore', 'medico'];
    if (!ruoliAbilitati.includes(user.role)) {
      return res.status(403).json({ message: 'Solo il medico o i responsabili possono inserire il referto' });
    }

    const esame = await EsameStrumentale.findById(req.params.id);
    if (!esame) return res.status(404).json({ message: 'Esame non trovato' });

    const { testoReferto } = req.body;

    let redattoDa = user.name || user.email || 'Medico';
    const staffMember = await getStaffByUser(user.id || user.userId, user.email);
    if (staffMember) {
      redattoDa = `${staffMember.firstName} ${staffMember.lastName}`;
    }

    if (!esame.referto) {
      esame.referto = {} as any;
    }
    esame.referto!.testoReferto = testoReferto?.trim();
    esame.referto!.redattoDa = redattoDa;
    esame.referto!.redattoDaId = staffMember?._id as any || user.id;
    esame.referto!.dataReferto = new Date();

    // Aggiorna status a refertato
    if (testoReferto?.trim()) {
      esame.status = 'refertato';
    }

    await esame.save();
    return res.json(esame.referto);
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Errore nel salvataggio del referto', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/esami-strumentali/:id/referto/firma
// Firma il referto
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/referto/firma', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const ruoliAbilitati = ['admin', 'coordinator', 'direttore', 'medico'];
    if (!ruoliAbilitati.includes(user.role)) {
      return res.status(403).json({ message: 'Non autorizzato a firmare il referto' });
    }

    const esame = await EsameStrumentale.findById(req.params.id);
    if (!esame) return res.status(404).json({ message: 'Esame non trovato' });
    if (!esame.referto) return res.status(400).json({ message: 'Nessun referto da firmare' });

    esame.referto.firmato = true;
    esame.referto.dataFirma = new Date();
    await esame.save();
    return res.json(esame.referto);
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Errore nella firma del referto', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/esami-strumentali/:id/referto/file
// Carica il file del referto (PDF/immagine)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/referto/file', authenticateToken, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const ruoliAbilitati = ['admin', 'coordinator', 'direttore', 'medico'];
    if (!ruoliAbilitati.includes(user.role)) {
      return res.status(403).json({ message: 'Non autorizzato a caricare il referto' });
    }

    const esame = await EsameStrumentale.findById(req.params.id);
    if (!esame) return res.status(404).json({ message: 'Esame non trovato' });

    const file = req.file as any;
    if (!file) return res.status(400).json({ message: 'Nessun file caricato' });

    let nomeFileServer: string;
    let urlCloudinary: string | undefined;
    let publicIdCloudinary: string | undefined;

    if (useCloudinary && file.path) {
      urlCloudinary = file.path;
      publicIdCloudinary = file.filename;
      nomeFileServer = file.filename;
    } else {
      nomeFileServer = file.filename;
    }

    if (!esame.referto) esame.referto = {} as any;
    esame.referto!.nomeFile = file.originalname;
    esame.referto!.nomeFileServer = nomeFileServer;
    esame.referto!.mimeType = file.mimetype;
    esame.referto!.dimensione = file.size;
    esame.referto!.urlCloudinary = urlCloudinary;
    esame.referto!.publicIdCloudinary = publicIdCloudinary;

    await esame.save();
    return res.json(esame.referto);
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Errore nel caricamento del file referto', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/esami-strumentali/:id/allegati
// Carica un allegato generico
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/allegati', authenticateToken, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const esame = await EsameStrumentale.findById(req.params.id);
    if (!esame) return res.status(404).json({ message: 'Esame non trovato' });

    const file = req.file as any;
    if (!file) return res.status(400).json({ message: 'Nessun file caricato' });

    const { descrizione } = req.body;

    let nomeFileServer: string;
    let urlCloudinary: string | undefined;
    let publicIdCloudinary: string | undefined;

    if (useCloudinary && file.path) {
      urlCloudinary = file.path;
      publicIdCloudinary = file.filename;
      nomeFileServer = file.filename;
    } else {
      nomeFileServer = file.filename;
    }

    let caricatoDa = user.name || user.email || 'Operatore';
    const staffMember = await getStaffByUser(user.id || user.userId, user.email);
    if (staffMember) caricatoDa = `${staffMember.firstName} ${staffMember.lastName}`;

    const allegato = {
      nomeFile: file.originalname,
      nomeFileServer,
      mimeType: file.mimetype,
      dimensione: file.size,
      descrizione: descrizione?.trim(),
      caricatoDa,
      caricatoDaId: staffMember?._id as any || user.id,
      dataCaricamento: new Date(),
      urlCloudinary,
      publicIdCloudinary,
    };

    esame.allegati.push(allegato as any);
    await esame.save();

    return res.status(201).json(esame.allegati[esame.allegati.length - 1]);
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Errore nel caricamento dell\'allegato', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/esami-strumentali/:id/allegati/:allegatoId
// Elimina un allegato
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id/allegati/:allegatoId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!isPrivilegiato(user.role)) return res.status(403).json({ message: 'Non autorizzato' });

    const esame = await EsameStrumentale.findById(req.params.id);
    if (!esame) return res.status(404).json({ message: 'Esame non trovato' });

    const allegato = esame.allegati.find((a: any) => a._id.toString() === req.params.allegatoId) as any;
    if (!allegato) return res.status(404).json({ message: 'Allegato non trovato' });

    // Elimina da Cloudinary se presente
    if (allegato.publicIdCloudinary && useCloudinary) {
      try {
        const resourceType = allegato.mimeType?.startsWith('image/') || allegato.mimeType === 'application/pdf' ? 'image' : 'raw';
        await cloudinary.uploader.destroy(allegato.publicIdCloudinary, { resource_type: resourceType });
      } catch {}
    } else if (allegato.nomeFileServer) {
      const filePath = path.join(UPLOAD_DIR, allegato.nomeFileServer);
      if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}
    }

    esame.allegati = esame.allegati.filter((a: any) => a._id.toString() !== req.params.allegatoId) as any;
    await esame.save();
    return res.json({ message: 'Allegato eliminato' });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Errore nell\'eliminazione', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/esami-strumentali/:id/archivia
// Archivia l'esame (solo admin/coordinator)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/archivia', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'coordinator') {
      return res.status(403).json({ message: 'Solo admin e coordinatori possono archiviare' });
    }

    const esame = await EsameStrumentale.findById(req.params.id);
    if (!esame) return res.status(404).json({ message: 'Esame non trovato' });
    if (esame.archiviato) return res.status(400).json({ message: 'Esame già archiviato' });

    esame.archiviato = true;
    esame.dataArchiviazione = new Date();
    esame.archiviatoDa = user.name || user.email || 'Sistema';
    esame.status = 'archiviato';
    await esame.save();

    return res.json({ message: 'Esame archiviato con successo', esame });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Errore nell\'archiviazione', error });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/esami-strumentali/:id/pdf-data
// Restituisce i dati strutturati per la stampa PDF
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/pdf-data', authenticateToken, async (req: Request, res: Response) => {
  try {
    const esame = await EsameStrumentale.findById(req.params.id)
      .populate('patient', 'firstName lastName birthDate codiceFiscale address')
      .populate('staff', 'firstName lastName role');

    if (!esame) return res.status(404).json({ message: 'Esame non trovato' });

    const paziente = esame.patient as any;
    const operatore = esame.staff as any;

    return res.json({
      esame: {
        id: esame._id,
        tipoEsame: esame.tipoEsame,
        dataEsame: esame.dataEsame ? new Date(esame.dataEsame).toLocaleDateString('it-IT') : '',
        orario: esame.orario || '',
        status: esame.status,
        note: esame.note || '',
      },
      paziente: {
        nome: `${paziente?.firstName || ''} ${paziente?.lastName || ''}`.trim(),
        dataNascita: paziente?.birthDate ? new Date(paziente.birthDate).toLocaleDateString('it-IT') : '',
        codiceFiscale: paziente?.codiceFiscale || '',
        indirizzo: paziente?.address || '',
      },
      operatore: {
        nome: `${operatore?.firstName || ''} ${operatore?.lastName || ''}`.trim(),
        ruolo: operatore?.role || '',
      },
      diaria: esame.diaria.map((d: any) => ({
        data: new Date(d.data).toLocaleDateString('it-IT'),
        ora: new Date(d.data).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        autore: d.autore,
        ruolo: d.ruoloAutore || '',
        testo: d.testo,
        firmato: d.firmato || false,
        dataFirma: d.dataFirma ? new Date(d.dataFirma).toLocaleDateString('it-IT') : '',
      })),
      referto: esame.referto ? {
        testo: esame.referto.testoReferto || '',
        redattoDa: esame.referto.redattoDa || '',
        dataReferto: esame.referto.dataReferto ? new Date(esame.referto.dataReferto).toLocaleDateString('it-IT') : '',
        firmato: esame.referto.firmato || false,
        dataFirma: esame.referto.dataFirma ? new Date(esame.referto.dataFirma).toLocaleDateString('it-IT') : '',
        fileReferto: esame.referto.nomeFile || '',
        urlReferto: esame.referto.urlCloudinary || '',
      } : null,
      allegati: esame.allegati.map((a: any) => ({
        nome: a.nomeFile,
        tipo: a.mimeType,
        caricatoDa: a.caricatoDa,
        data: new Date(a.dataCaricamento).toLocaleDateString('it-IT'),
        url: a.urlCloudinary || '',
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Errore nel recupero dati PDF', error });
  }
});

export default router;
