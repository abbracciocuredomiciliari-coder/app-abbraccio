import './config/env';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import jwt from 'jsonwebtoken';
import connectDB from './config/db';
import { verificaConnessioneSMTP, inviaEmailNuovoPianoDiLavoro } from './utils/email';
import { authenticateToken } from './middleware/auth';
import { authorizeRole } from './middleware/roles';
import authRouter from './routes/auth';
import patientsRouter from './routes/patients';
import staffRouter from './routes/staff';
import workplanRouter from './routes/workplan';
import dashboardRouter from './routes/dashboard';
import procedureDocumentsRouter from './routes/procedureDocuments';
import equipmentRouter from './routes/equipment';
import suppliesRouter from './routes/supplies';
import patientDocumentsRouter from './routes/patientDocuments';
import workplanAccessRouter from './routes/workplanAccess';
import diarioClinicoRouter from './routes/diarioClinico';
import messagesRouter from './routes/messages';
import obiettiviRouter from './routes/obiettivi';
import reportsRouter from './routes/reports';
import allegatiRouter from './routes/allegati';
import archivioRouter from './routes/archivio';
import checklistDefibrillatoreRouter from './routes/checklistDefibrillatore';
import schedaControlloDefibrillatoreRouter from './routes/schedaControlloDefibrillatore';
import checklistGlucometroRouter from './routes/checklistGlucometro';
import esamiStrumentaliRouter from './routes/esamiStrumentali';
import prelieviRouter from './routes/prelievi';
import auditLogRouter from './routes/auditLog';
import supplyRequestsRouter from './routes/supplyRequests';
import gdprRouter from './routes/gdpr';
import exportSiatRouter from './routes/exportSiat';
import richiestePrenotazioniRouter from './routes/richiestePrenotazioni';
import richiestePazienteRouter from './routes/richiestePaziente';
import eventiAvversiRouter from './routes/eventiAvversi';
import schedaServizioRouter from './routes/schedaServizio';
import contrattoRouter from './routes/contratto';
import customerSatisfactionRouter from './routes/customerSatisfaction';
import schedeDimissioneRouter from './routes/schedeDimissione';
import riformulazioniPAIRouter from './routes/riformulazioniPAI';
import formazioneSanitariaRouter from './routes/formazioneSanitaria';
import verbaliEquipeRouter from './routes/verbaliEquipe';

if (!process.env.JWT_SECRET) {
  console.error('ERRORE: JWT_SECRET non è impostato. Configurare la variabile d\'ambiente nel file .env prima di avviare il server.');
  process.exit(1);
}

const app: Application = express();
const port = process.env.PORT || 4000;

// Trust proxy per Render/Vercel (necessario per rate-limit con X-Forwarded-For)
app.set('trust proxy', 1);

// ─── Security headers (Helmet) ────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
  hsts: {
    maxAge: 31536000, // 1 anno
    includeSubDomains: true,
    preload: true,
  },
}));

// ─── CORS — solo origini autorizzate ─────────────────────────────────────────
const allowedOrigins: string[] = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://app-abbraccio-frontend.vercel.app',
  'https://app-abbraccio-frontend.onrender.com',
  'https://abbraccio-cure.onrender.com',
  'https://api.abbracciocuredomiciliari.it',
];
// Aggiungi FRONTEND_URL da env se diverso da quelli già in lista
if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // Permetti richieste senza origin (Postman, curl, app mobile)
    if (!origin) return callback(null, true);
    // Controlla lista allowlist
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Permetti qualsiasi preview deploy Vercel del progetto app-abbraccio-frontend
    if (
      origin.endsWith('.vercel.app') &&
      new URL(origin).hostname.startsWith('app-abbraccio-frontend')
    ) return callback(null, true);
    // Permetti qualsiasi dominio Render (per staging/preview)
    if (origin.endsWith('.onrender.com')) return callback(null, true);
    console.warn(`CORS bloccato per origine non autorizzata: ${origin}`);
    return callback(new Error(`Origine non autorizzata: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// ─── Middleware autenticazione + autorizzazione per file statici /uploads ───────
// Regole:
//   - admin / coordinator / direttore → accesso a tutti i file
//   - operatori → accesso solo a file nella sottocartella con il proprio userId
//     (il path è /uploads/<cartella>/<filename>, dove filename inizia con userId-)
const proteggiUploads = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) {
    return res.status(401).json({ message: 'Autenticazione richiesta per accedere ai file' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string; role: string };
    const ruoliPrivilegiati = ['admin', 'coordinator', 'direttore'];
    // Admin/coordinator/direttore: accesso libero
    if (ruoliPrivilegiati.includes(payload.role)) return next();
    // Operatori: il file deve appartenere al loro userId
    // I file vengono salvati con nome che inizia con `<timestamp>-<random>`,
    // ma il path contiene la cartella del tipo (prelievi, esami-strumentali, cartelle).
    // Verifica che il record in DB punti a questo utente — se non possibile dal path
    // statico, come minimo blocchiamo i path che includono esplicitamente un userId altrui.
    // Per massima sicurezza, gli operatori accedono ai propri file solo tramite API.
    return res.status(403).json({ message: 'Accesso ai file non autorizzato. Usare le API.' });
  } catch {
    return res.status(401).json({ message: 'Token non valido' });
  }
};

connectDB();

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'App Abbraccio API in esecuzione' });
});

app.use('/api/auth', authRouter);
app.use('/api/gdpr', gdprRouter);
app.use('/api/export', exportSiatRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/staff', staffRouter);
app.use('/api/workplan', workplanRouter);
app.use('/api/procedure-documents', procedureDocumentsRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/supplies', suppliesRouter);
app.use('/api/documents', patientDocumentsRouter);
app.use('/api/workplan-access', workplanAccessRouter);
app.use('/api/diario', diarioClinicoRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/obiettivi', obiettiviRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/allegati', allegatiRouter);
app.use('/api/archivio', archivioRouter);
app.use('/api/checklist-defibrillatore', checklistDefibrillatoreRouter);
app.use('/api/scheda-controllo-defibrillatore', schedaControlloDefibrillatoreRouter);
app.use('/api/checklist-glucometro', checklistGlucometroRouter);
app.use('/api/esami-strumentali', esamiStrumentaliRouter);
app.use('/api/prelievi', prelieviRouter);
app.use('/api/audit-log', auditLogRouter);
app.use('/api/supply-requests', supplyRequestsRouter);
app.use('/api/richieste-prenotazioni', richiestePrenotazioniRouter);
app.use('/api/richieste-paziente', richiestePazienteRouter);
app.use('/api/eventi-avversi', eventiAvversiRouter);
app.use('/api/scheda-servizio', schedaServizioRouter);
app.use('/api/contratto', contrattoRouter);
app.use('/api/customer-satisfaction', customerSatisfactionRouter);
app.use('/api/schede-dimissione', schedeDimissioneRouter);
app.use('/api/riformulazioni-pai', riformulazioniPAIRouter);
app.use('/api/formazione-sanitaria', formazioneSanitariaRouter);
app.use('/api/verbali-equipe', verbaliEquipeRouter);
// Alias senza prefisso /api per compatibilità con URL diretti degli allegati
app.use('/allegati', allegatiRouter);

// Serve file statici uploads — protetti da autenticazione JWT
app.use('/uploads', proteggiUploads, express.static(path.join(process.cwd(), 'uploads')));

// ─── Endpoint diagnostica SMTP (per verificare configurazione) ────────────────
app.get('/api/smtp-config', authenticateToken, authorizeRole('admin'), async (_req: Request, res: Response) => {
  const config = {
    host: process.env.SMTP_HOST || 'NON CONFIGURATO',
    port: process.env.SMTP_PORT || 'NON CONFIGURATO',
    secure: process.env.SMTP_SECURE || 'NON CONFIGURATO',
    user: process.env.SMTP_USER || 'NON CONFIGURATO',
    passConfigured: process.env.SMTP_PASS ? '✅ CONFIGURATA' : '❌ MANCANTE',
    adminEmail: process.env.ADMIN_EMAIL || 'NON CONFIGURATO',
  };
  return res.json(config);
});

// ─── Endpoint test email (per diagnostica SMTP) ───────────────────────────────
app.get('/api/test-email', authenticateToken, authorizeRole('admin'), async (req: Request, res: Response) => {
  const { to } = req.query;
  if (!to) return res.status(400).json({ message: 'Parametro ?to=email richiesto' });
  try {
    await inviaEmailNuovoPianoDiLavoro(
      to as string,
      'Operatore Test',
      'Paziente Test',
      new Date().toLocaleDateString('it-IT'),
      'Test connessione SMTP — App Abbraccio'
    );
    return res.json({ success: true, to, message: 'Email di test inviata — controlla i log del server per dettagli' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// ─── Error handler globale ─────────────────────────────────────────────────
// Intercetta errori (inclusi multer/Cloudinary) e restituisce JSON
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Global Error]', err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({
    message: err.message || 'Errore interno del server',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

app.listen(port, async () => {
  console.log(`Backend avviato su http://localhost:${port}`);
  // Verifica connessione SMTP all'avvio
  await verificaConnessioneSMTP();
});
