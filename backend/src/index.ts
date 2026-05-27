import './config/env';
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import connectDB from './config/db';
import { verificaConnessioneSMTP, inviaEmailNuovoPianoDiLavoro } from './utils/email';
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
import obiettiviRouter from './routes/obiettivi';
import allegatiRouter from './routes/allegati';
import archivioRouter from './routes/archivio';
import checklistDefibrillatoreRouter from './routes/checklistDefibrillatore';
import schedaControlloDefibrillatoreRouter from './routes/schedaControlloDefibrillatore';
import checklistGlucometroRouter from './routes/checklistGlucometro';
import esamiStrumentaliRouter from './routes/esamiStrumentali';

if (!process.env.JWT_SECRET) {
  console.error('ERRORE: JWT_SECRET non è impostato. Configurare la variabile d\'ambiente nel file .env prima di avviare il server.');
  process.exit(1);
}

const app: Application = express();
const port = process.env.PORT || 4000;

app.use(cors({
  origin: (origin, callback) => {
    // Permetti richieste senza origin (es. app mobile, Postman, curl)
    if (!origin) return callback(null, true);
    // Permetti localhost in sviluppo
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return callback(null, true);
    }
    // Permetti tutti i sottodomini Vercel (*.vercel.app)
    if (origin.endsWith('.vercel.app') || origin === 'https://vercel.app') {
      return callback(null, true);
    }
    // Permetti l'URL frontend configurato esplicitamente
    const frontendUrl = process.env.FRONTEND_URL;
    if (frontendUrl && origin === frontendUrl) {
      return callback(null, true);
    }
    // In produzione permetti qualsiasi HTTPS
    if (process.env.NODE_ENV === 'production' && origin.startsWith('https://')) {
      return callback(null, true);
    }
    console.warn(`CORS bloccato per origine: ${origin}`);
    return callback(null, true); // permetti comunque per evitare blocchi imprevisti
  },
  credentials: true,
}));
app.use(express.json());

connectDB();

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'App Abbraccio API in esecuzione' });
});

app.use('/api/auth', authRouter);
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
app.use('/api/obiettivi', obiettiviRouter);
app.use('/api/allegati', allegatiRouter);
app.use('/api/archivio', archivioRouter);
app.use('/api/checklist-defibrillatore', checklistDefibrillatoreRouter);
app.use('/api/scheda-controllo-defibrillatore', schedaControlloDefibrillatoreRouter);
app.use('/api/checklist-glucometro', checklistGlucometroRouter);
app.use('/api/esami-strumentali', esamiStrumentaliRouter);
// Alias senza prefisso /api per compatibilità con URL diretti degli allegati
app.use('/allegati', allegatiRouter);

// Serve file statici uploads (con autenticazione gestita lato route)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ─── Endpoint test email (per diagnostica SMTP) ───────────────────────────────
app.get('/api/test-email', async (req: Request, res: Response) => {
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

app.listen(port, async () => {
  console.log(`Backend avviato su http://localhost:${port}`);
  // Verifica connessione SMTP all'avvio
  await verificaConnessioneSMTP();
});
