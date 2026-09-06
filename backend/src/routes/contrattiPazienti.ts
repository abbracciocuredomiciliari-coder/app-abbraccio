import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import ContrattoPaziente from '../models/ContrattoPaziente';
import Patient from '../models/Patient';
import PatientDocument from '../models/PatientDocument';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { inviaEmail } from '../utils/email';
import { decrypt } from '../utils/encryption';

const router = Router();
const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];

const AZIENDA = {
  nome: process.env.AZIENDA_NOME || 'ABBRACCIO CURE DOMICILIARI S.R.L.S.',
  indirizzo: process.env.AZIENDA_INDIRIZZO || 'ROMA (RM) VIA DI S MARIA AUSILIATRICE 4B',
  capCitta: process.env.AZIENDA_CAP_CITTA || 'CAP 00181',
  pec: process.env.AZIENDA_PEC || 'abbracciocuredomiciliari@facilepec.com',
  rea: process.env.AZIENDA_REA || 'RM - 1777027',
  cf: process.env.AZIENDA_CF || '18316251000',
  piva: process.env.AZIENDA_PIVA || 'P.IVA da configurare',
};

function formatData(d: any) {
  if (!d) return '___';
  try {
    return new Date(d).toLocaleDateString('it-IT');
  } catch {
    return String(d);
  }
}

function normalizzaPaziente(raw: any) {
  const p = raw && raw.toJSON ? raw.toJSON() : { ...raw };
  p.address = decrypt(p.address);
  p.contactPhone = decrypt(p.contactPhone);
  p.codiceFiscale = decrypt(p.codiceFiscale);
  p.email = p.email || '';
  return p;
}

function generaHtmlContratto(contratto: any, paziente: any, includeFirma = false, firmaImg?: string) {
  if (contratto.profilo === 'Assistente familiare') {
    return generaHtmlContrattoBadante(contratto, paziente, includeFirma, firmaImg);
  }
  const importo = Number(contratto.importo || 150).toFixed(2).replace('.', ',');
  const luogo = contratto.luogoFirma || 'Roma';
  const data = contratto.dataFirma ? new Date(contratto.dataFirma).toLocaleDateString('it-IT') : formatData(new Date());

  const indirizzoParts = (paziente.address || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  const citta = indirizzoParts.length > 1 ? indirizzoParts[indirizzoParts.length - 1] : '';
  const indirizzo = indirizzoParts.length > 1 ? indirizzoParts.slice(0, -1).join(', ') : paziente.address || '';

  const firmaHtml = includeFirma && firmaImg
    ? `<div style="margin-top:24px;border-top:2px solid #1e4d8c;padding-top:20px;">
        <h3 style="color:#1e4d8c;font-size:13px;margin:0 0 12px;">CONFERMA DI FIRMA</h3>
        <p style="font-size:12px;margin:4px 0;"><strong>Luogo e data:</strong> ${luogo}, ${data}</p>
        <p style="font-size:12px;margin:4px 0;"><strong>Firmatario:</strong> ${contratto.nome || `${paziente.firstName} ${paziente.lastName}`}</p>
        <img src="${firmaImg}" alt="Firma" style="max-width:220px;max-height:80px;border:1px solid #d1d5db;margin-top:8px;" />
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>Contratto d'incarico - ${paziente.firstName} ${paziente.lastName}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 30px; max-width: 900px; line-height: 1.45; }
    .header { background: #1e4d8c; color: #fff; padding: 22px 30px; border-radius: 10px 10px 0 0; }
    .header h1 { margin: 0; font-size: 22px; }
    .header h2 { margin: 6px 0 0; font-size: 14px; font-weight: 400; }
    .header-dati { font-size: 10px; margin-top: 8px; line-height: 1.5; opacity: .95; }
    .sub-header { color: #1e4d8c; font-size: 14px; font-weight: 700; text-align: center; margin: 16px 0; }
    .section { background: #eef3f7; padding: 8px 14px; margin: 14px 0 8px; border-left: 4px solid #1e4d8c; }
    .section-title { font-weight: 700; color: #1e4d8c; font-size: 13px; margin: 0; }
    p { margin: 6px 0; }
    .field-row { display: flex; gap: 20px; margin: 8px 0; }
    .field { flex: 1; border-bottom: 1px solid #94a3b8; padding: 2px 0; }
    .field-full { border-bottom: 1px solid #94a3b8; padding: 2px 0; margin: 8px 0; }
    .field-label { font-weight: 700; font-size: 10px; color: #475569; display: block; margin-bottom: 2px; }
    .checkbox { font-size: 14px; margin-right: 6px; }
    .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin: 12px 0; }
    .price { color: #059669; font-weight: 700; font-size: 14px; }
    .warning { background: #fef2f2; border-left: 4px solid #dc2626; padding: 10px 14px; color: #7f1d1d; }
    .footer { text-align: center; font-size: 9px; color: #64748b; margin-top: 30px; padding-top: 12px; border-top: 1px solid #cbd5e1; }
    @media print { .no-print { display: none; } button { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>ABBRACCIO CURE DOMICILIARI S.R.L.S.</h1>
    <h2>CONTRATTO D'INCARICO E IMPEGNO DI RECLUTAMENTO</h2>
    <h2 style="font-size:12px;font-weight:400;">ASSISTENZA DOMICILIARE SANITARIA, SOCIO-SANITARIA E FAMILIARE (OSS / INFERMIERE / ASSISTENTE FAMILIARE / BADANTE/COLF)</h2>
    <div class="header-dati">
      Sede Legale: ${AZIENDA.indirizzo} — ${AZIENDA.capCitta}<br/>
      C.F. / P.IVA: ${AZIENDA.cf} | N. REA: ${AZIENDA.rea}<br/>
      PEC: ${AZIENDA.pec} | Legale Rappresentante: SCHEMBRI SIMONA
    </div>
  </div>

  <div class="sub-header">CONTRATTO TRA AGENZIA E COMMITTENTE</div>

  <div class="section"><p class="section-title">1. PARTI CONTRAENTI</p></div>
  <p>Tra la Società <strong>ABBRACCIO CURE DOMICILIARI S.R.L.S.</strong> (di seguito "Agenzia") e il sottoscritto Committente:</p>

  <div class="field-row">
    <div class="field" style="flex:1.5"><span class="field-label">Nome e Cognome</span>${paziente.firstName} ${paziente.lastName}</div>
  </div>
  <div class="field-row">
    <div class="field" style="flex:1.2"><span class="field-label">Codice Fiscale</span>${paziente.codiceFiscale || ''}</div>
    <div class="field" style="flex:1"><span class="field-label">Data di Nascita</span>${formatData(paziente.birthDate)}</div>
  </div>
  <div class="field-row">
    <div class="field" style="flex:2"><span class="field-label">Indirizzo di Residenza</span>${indirizzo}</div>
    <div class="field" style="flex:1"><span class="field-label">Città</span>${citta}</div>
  </div>
  <div class="field-row">
    <div class="field" style="flex:0.8"><span class="field-label">CAP</span></div>
    <div class="field" style="flex:0.8"><span class="field-label">Prov</span></div>
    <div class="field" style="flex:1.2"><span class="field-label">Telefono / Cellulare</span>${paziente.contactPhone || ''}</div>
    <div class="field" style="flex:1.5"><span class="field-label">Email</span>${paziente.email || ''}</div>
  </div>

  <div class="section"><p class="section-title">2. OGGETTO DELL'INCARICO SPECIALISTICO</p></div>
  <p>Il Committente conferisce all'Agenzia l'incarico professionale finalizzato all'avvio immediato delle attività di reclutamento, screening dei curricula, verifica dei titoli abilitanti e selezione del seguente profilo professionale sanitario/socio-sanitario per assistenza domiciliare:</p>
  <div class="box" style="display:flex;gap:40px;flex-wrap:wrap;">
    <span>Operatore Socio-Sanitario (O.S.S.)</span>
    <span>Infermiere Professionale</span>
    <span>Assistente familiare</span>
    <span>Badante/colf</span>
  </div>

  <div class="section"><p class="section-title">3. CORRISPETTIVO D'AVVIO, CONDIZIONI E SCAVALCO COSTI</p></div>
  <div class="box">
    <p class="price">Diritti di Avvio Ricerca e Reclutamento: € ${importo} (oltre IVA)</p>
    <p>Importo versato contestualmente alla firma del presente contratto a copertura dei costi operativi di ricerca, valutazione dei titoli professionali e colloquio selettivo del personale proposto.</p>
  </div>
  <p><strong>COMPENSAZIONE E SCALAVECCHIA / SCALAVECCHIO DEL CORRISPETTIVO:</strong><br/>
  In caso di accettazione del profilo proposto e di effettivo avvio dell'assistenza domiciliare, l'importo di € ${importo},00 già versato verrà interamente scalato/scomputato dal costo totale del servizio di assistenza o dal saldo finale dovuto all'Agenzia per il collocamento.</p>

  <div class="warning">
    <strong>CLAUSOLA DI RINUNCIA (TRATTENUTA):</strong><br/>
    Qualora il Committente decida di rinunciare all'incarico o recedere dal contratto dopo che l'Agenzia ha svolto la ricerca ed individuato un lavoratore (O.S.S., Infermiere, Assistente familiare o Badante/colf) idoneo e rispondente ai requisiti, l'importo di € ${importo},00 <strong>non verrà restituito</strong> e sarà trattenuto a titolo di compenso per le attività istruttorie e lavorative svolte.
  </div>

  <div class="section"><p class="section-title">4. DURATA E RECESSO</p></div>
  <p>Il presente contratto ha durata dalla data di sottoscrizione sino all'effettivo avvio del servizio di assistenza domiciliare, comunque non oltre 12 mesi. Ciascuna parte potrà recedere con preavviso scritto di 30 giorni, salvo quanto previsto dalla clausola di rinuncia.</p>

  <div class="section"><p class="section-title">5. TRATTAMENTO DATI</p></div>
  <p>I dati personali saranno trattati nel rispetto del Regolamento UE 2016/679 e delle norme nazionali vigenti, esclusivamente per le finalità di reclutamento e gestione del servizio richiesto.</p>

  <p style="margin-top:24px;"><strong>Letto, confermato e sottoscritto in ${luogo} il ${data}.</strong></p>
  <div class="field-row" style="margin-top:30px;">
    <div class="field" style="flex:1;height:60px;"><span class="field-label">Timbro e firma Agenzia</span></div>
    <div class="field" style="flex:1;height:60px;"><span class="field-label">Firma del Committente</span></div>
  </div>

  ${firmaHtml}

  <div class="no-print" style="text-align:center;margin-top:24px;">
    <button onclick="window.print()" style="background:#1e4d8c;color:#fff;border:none;border-radius:8px;padding:12px 28px;font-size:14px;cursor:pointer;font-weight:700;">;font-weight:700;">🖨️ Stampa / Salva PDF</button>
  </div>

  <div class="footer">Documento generato elettronicamente da Abbraccio Cure Domiciliari S.R.L.S. — ${new Date().toLocaleString('it-IT')}</div>
</body>
</html>`;
}

function generaHtmlContrattoBadante(contratto: any, paziente: any, includeFirma = false, firmaImg?: string) {
  const importo1 = Number(contratto.importo || 150).toFixed(2).replace('.', ',');
  const importo2 = '350,00';
  const luogo = contratto.luogoFirma || 'Roma';
  const data = contratto.dataFirma ? new Date(contratto.dataFirma).toLocaleDateString('it-IT') : formatData(new Date());

  const indirizzoParts = (paziente.address || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  const citta = indirizzoParts.length > 1 ? indirizzoParts[indirizzoParts.length - 1] : '';
  const indirizzo = indirizzoParts.length > 1 ? indirizzoParts.slice(0, -1).join(', ') : paziente.address || '';

  const firmaHtml = includeFirma && firmaImg
    ? `<div style="margin-top:24px;border-top:2px solid #1e4d8c;padding-top:20px;">
        <h3 style="color:#1e4d8c;font-size:13px;margin:0 0 12px;">CONFERMA DI FIRMA</h3>
        <p style="font-size:12px;margin:4px 0;"><strong>Luogo e data:</strong> ${luogo}, ${data}</p>
        <p style="font-size:12px;margin:4px 0;"><strong>Firmatario:</strong> ${contratto.nome || `${paziente.firstName} ${paziente.lastName}`}</p>
        <img src="${firmaImg}" alt="Firma" style="max-width:220px;max-height:80px;border:1px solid #d1d5db;margin-top:8px;" />
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>Mandato ricerca e selezione badante - ${paziente.firstName} ${paziente.lastName}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 30px; max-width: 900px; line-height: 1.45; }
    .header { background: #1e4d8c; color: #fff; padding: 22px 30px; border-radius: 10px 10px 0 0; }
    .header h1 { margin: 0; font-size: 22px; }
    .header h2 { margin: 6px 0 0; font-size: 14px; font-weight: 400; }
    .header-dati { font-size: 10px; margin-top: 8px; line-height: 1.5; opacity: .95; }
    .sub-header { color: #1e4d8c; font-size: 16px; font-weight: 700; text-align: center; margin: 20px 0 6px; text-transform: uppercase; }
    .section { background: #eef3f7; padding: 8px 14px; margin: 14px 0 8px; border-left: 4px solid #1e4d8c; }
    .section-title { font-weight: 700; color: #1e4d8c; font-size: 13px; margin: 0; }
    p { margin: 6px 0; }
    .field-row { display: flex; gap: 20px; margin: 8px 0; }
    .field { flex: 1; border-bottom: 1px solid #94a3b8; padding: 2px 0; }
    .field-label { font-weight: 700; font-size: 10px; color: #475569; display: block; margin-bottom: 2px; }
    .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; vertical-align: top; }
    th { background: #1e4d8c; color: #fff; font-size: 11px; }
    .price { text-align: right; font-weight: 700; white-space: nowrap; }
    .note { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 10px 14px; color: #166534; font-size: 11px; }
    .sign-row { display: flex; gap: 20px; margin: 30px 0 10px; }
    .sign-cell { flex: 1; border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 11px; text-align: center; }
    .footer { text-align: center; font-size: 9px; color: #64748b; margin-top: 30px; padding-top: 12px; border-top: 1px solid #cbd5e1; }
    @media print { .no-print { display: none; } button { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>ABBRACCIO CURE DOMICILIARI S.R.L.S.</h1>
    <h2>MANDATO DI RICERCA, SELEZIONE E INTERMEDIAZIONE PERSONALE</h2>
    <div class="header-dati">
      Sede Legale: ${AZIENDA.indirizzo} — ${AZIENDA.capCitta}<br/>
      C.F. / P.IVA: ${AZIENDA.cf} | N. REA: ${AZIENDA.rea}<br/>
      PEC: ${AZIENDA.pec} | Legale Rappresentante: SCHEMBRI SIMONA
    </div>
  </div>

  <div class="section"><p class="section-title">1. PARTI CONTRAENTI</p></div>
  <p>Tra la Società <strong>ABBRACCIO CURE DOMICILIARI S.R.L.S.</strong> (di seguito "Agenzia"), con i dati sociali in epigrafe, e il sottoscritto Committente (Famiglia / Datore di lavoro):</p>

  <div class="field-row">
    <div class="field" style="flex:2"><span class="field-label">Nome e Cognome</span>${paziente.firstName} ${paziente.lastName}</div>
  </div>
  <div class="field-row">
    <div class="field" style="flex:1.2"><span class="field-label">Codice Fiscale</span>${paziente.codiceFiscale || ''}</div>
    <div class="field" style="flex:1"><span class="field-label">Data di Nascita</span>${formatData(paziente.birthDate)}</div>
  </div>
  <div class="field-row">
    <div class="field" style="flex:1.4"><span class="field-label">Luogo di Nascita</span></div>
    <div class="field" style="flex:0.4"><span class="field-label">Prov</span></div>
    <div class="field" style="flex:1"><span class="field-label">Nazionalità</span></div>
  </div>
  <div class="field-row">
    <div class="field" style="flex:2.2"><span class="field-label">Indirizzo Residenza</span>${indirizzo}</div>
    <div class="field" style="flex:0.8"><span class="field-label">Città</span>${citta}</div>
  </div>
  <div class="field-row">
    <div class="field" style="flex:0.8"><span class="field-label">CAP</span></div>
    <div class="field" style="flex:0.8"><span class="field-label">Prov</span></div>
    <div class="field" style="flex:1.2"><span class="field-label">Telefono / Cellulare</span>${paziente.contactPhone || ''}</div>
    <div class="field" style="flex:1.5"><span class="field-label">Email</span>${paziente.email || ''}</div>
  </div>

  <div class="section"><p class="section-title">2. OGGETTO DELL'INCARICO E MODALITÀ DI ESECUZIONE</p></div>
  <p>Il Committente conferisce all'Agenzia l'incarico professionale finalizzato alla ricerca, screening, valutazione e selezione di un assistente familiare (badante / colf / assistente domiciliare) rispondente alle esigenze assistenziali della famiglia. L'Agenzia si impegna a sottoporre al Committente i profili idonei e coordinare i colloqui conoscitivi.</p>

  <div class="section"><p class="section-title">3. CORRISPETTIVO ECONOMICO E MODALITÀ DI PAGAMENTO</p></div>
  <p>A fronte delle prestazioni svolte, il Committente si obbliga a corrispondere all'Agenzia le seguenti competenze:</p>

  <table>
    <thead>
      <tr>
        <th style="width:28%">Fase del Servizio</th>
        <th>Descrizione Prestazione</th>
        <th style="width:24%;text-align:right;">Importo (Oltre IVA)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1. Reclutamento &amp; Selezione</strong></td>
        <td>Attivazione ricerca, pubblicazione annunci, screening curricula e colloquio di selezione. Dovuto alla firma del presente contratto.</td>
        <td class="price">€ ${importo1}</td>
      </tr>
      <tr>
        <td><strong>2. Collocamento con Successo</strong></td>
        <td>Sottoscrizione del contratto di lavoro o effettivo inserimento lavorativo della badante selezionata presso la famiglia.</td>
        <td class="price">€ ${importo2}</td>
      </tr>
    </tbody>
  </table>

  <div class="note">
    <strong>Tutela Normativa (Art. 11 D.Lgs. 276/2003):</strong> In conformità alla legge italiana, il servizio erogato nei confronti del lavoratore domestico/badante è a titolo completamente gratuito. Nessuna quota o trattenuta viene richiesta all'assistente familiare. Tutti i corrispettivi per le attività di intermediazione gravano esclusivamente sul Committente.
  </div>

  <div class="section"><p class="section-title">4. GARANZIA DI SOSTITUZIONE</p></div>
  <p>Qualora il rapporto lavorativo con la badante si interrompa entro 30 giorni dall'assunzione per dimissioni o mancato superamento del periodo di prova, l'Agenzia effettuerà una seconda selezione senza l'addebito di ulteriori costi di avvio o esito positivo.</p>

  <p style="margin-top:18px;"><strong>Luogo e Data:</strong> ${luogo}, lì ${data}</p>

  <div class="sign-row">
    <div class="sign-cell">Firma del Committente (Famiglia)</div>
    <div class="sign-cell">Per <strong>ABBRACCIO CURE DOMICILIARI S.R.L.S.</strong><br/>(Legale Rappresentante: SCHEMBRI SIMONA)</div>
  </div>

  ${firmaHtml}

  <div class="box" style="margin-top:22px;">
    <p style="margin:0 0 10px 0;"><strong>APPROVAZIONE SPECIFICA CLAUSOLE</strong></p>
    <p style="font-size:11px;margin:0 0 20px 0;">Ai sensi e per gli effetti degli art. 1341 e 1342 c.c., il Committente dichiara di approvare specificamente le clausole di cui all'art. 3 (Corrispettivo Economico), art. 3-bis (Gratuità per il Lavoratore ex D.Lgs. 276/2003) e art. 4 (Garanzia di Sostituzione).</p>
    <div class="field" style="width:60%;margin-top:16px;"><span class="field-label">Firma del Committente per specifica approvazione</span></div>
  </div>

  <div class="no-print" style="text-align:center;margin-top:24px;">
    <button onclick="window.print()" style="background:#1e4d8c;color:#fff;border:none;border-radius:8px;padding:12px 28px;font-size:14px;cursor:pointer;font-weight:700;">🖨️ Stampa / Salva PDF</button>
  </div>

  <div class="footer">Documento generato elettronicamente da Abbraccio Cure Domiciliari S.R.L.S. — ${new Date().toLocaleString('it-IT')}</div>
</body>
</html>`;
}

// POST /api/contratti-pazienti — crea un nuovo contratto d'incarico
router.post('/', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('contratti_pazienti', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const { patient, profilo, importo, email } = req.body;
    if (!patient || !profilo) return res.status(400).json({ message: 'Paziente e profilo obbligatori' });
    if (!['OSS', 'Infermiere', 'Assistente familiare', 'Operatore generale'].includes(profilo)) return res.status(400).json({ message: 'Profilo non valido' });

    const paziente = await Patient.findById(patient);
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });

    const token = crypto.randomBytes(32).toString('hex');
    const contratto = await ContrattoPaziente.create({
      patient,
      profilo,
      importo: Number(importo) || 150,
      token,
      email: email || paziente.email,
      nome: `${paziente.firstName} ${paziente.lastName}`,
      stato: 'emesso',
    });

    return res.status(201).json(contratto);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella creazione del contratto', error: error.message });
  }
});

// GET /api/contratti-pazienti — lista per paziente
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { patient } = req.query;
    const query: any = {};
    if (patient) query.patient = patient;
    const contratti = await ContrattoPaziente.find(query).sort({ data: -1 }).populate('patient', 'firstName lastName');
    return res.json(contratti);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nel caricamento contratti', error: error.message });
  }
});

// GET /api/contratti-pazienti/anteprima/:token — anteprima pubblica del contratto (lettura prima della firma)
router.get('/anteprima/:token', async (req: Request, res: Response) => {
  try {
    const contratto = await ContrattoPaziente.findOne({ token: req.params.token })
      .populate('patient', 'firstName lastName birthDate address contactPhone codiceFiscale email');
    if (!contratto) return res.status(404).json({ message: 'Link non valido' });

    if (contratto.stato === 'firmato' && contratto.htmlFirmato) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(contratto.htmlFirmato);
    }

    const paziente = normalizzaPaziente(contratto.patient);
    const html = generaHtmlContratto(contratto, paziente, false, undefined);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore generazione anteprima contratto', error: error.message });
  }
});

// GET /api/contratti-pazienti/:id/pdf — stampa/visualizza HTML
router.get('/:id/pdf', authenticateToken, async (req: Request, res: Response) => {
  try {
    const contratto = await ContrattoPaziente.findById(req.params.id).populate('patient', 'firstName lastName birthDate address contactPhone codiceFiscale email');
    if (!contratto) return res.status(404).json({ message: 'Contratto non trovato' });

    // Se il contratto è già firmato, restituiamo l'HTML esatto archiviato con la firma
    if (contratto.stato === 'firmato' && contratto.htmlFirmato) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(contratto.htmlFirmato);
    }

    const paziente = normalizzaPaziente(contratto.patient);
    const html = generaHtmlContratto(contratto, paziente, false, undefined);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore generazione PDF', error: error.message });
  }
});

// GET /api/contratti-pazienti/firma/:token — verifica link firma (pubblico)
router.get('/firma/:token', async (req: Request, res: Response) => {
  try {
    const contratto = await ContrattoPaziente.findOne({ token: req.params.token })
      .populate('patient', 'firstName lastName birthDate address contactPhone codiceFiscale email');
    if (!contratto) return res.status(404).json({ message: 'Link non valido' });
    if (contratto.stato === 'firmato') return res.status(400).json({ message: 'Contratto già firmato', giaFirmato: true });
    return res.json({
      patient: contratto.patient,
      profilo: contratto.profilo,
      importo: contratto.importo,
      nome: contratto.nome,
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore verifica link', error: error.message });
  }
});

// POST /api/contratti-pazienti/:id/invia-email — invia link firma al paziente/caregiver
router.post('/:id/invia-email', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('contratti_pazienti', 'UPDATE'), async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email obbligatoria' });

    const contratto = await ContrattoPaziente.findById(req.params.id)
      .populate('patient', 'firstName lastName birthDate address contactPhone codiceFiscale email');
    if (!contratto) return res.status(404).json({ message: 'Contratto non trovato' });
    if (!contratto.token) contratto.token = crypto.randomBytes(32).toString('hex');
    contratto.email = email;
    await contratto.save();

    const pazienteNorm = normalizzaPaziente(contratto.patient);
    const htmlContratto = generaHtmlContratto(contratto, pazienteNorm, false);

    const frontendUrl = process.env.FRONTEND_URL || 'https://app.abbracciocuredomiciliari.it';
    const apiProtocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const apiHost = req.get('host') || 'api.abbracciocuredomiciliari.it';
    const anteprimaUrl = `${apiProtocol}://${apiHost}/api/contratti-pazienti/anteprima/${contratto.token}`;
    const firmaUrl = `${frontendUrl}/firma-contratto-paziente?token=${contratto.token}`;

    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
      <h2 style="color:#1e4d8c;margin-top:0;">Contratto d'incarico</h2>
      <p>Gentile <strong>${pazienteNorm.firstName || ''} ${pazienteNorm.lastName || ''}</strong>,</p>
      <p>in allegato trovi il contratto d'incarico completo per l'attività di reclutamento del profilo <strong>${contratto.profilo}</strong>.</p>
      <p style="margin:16px 0;padding:16px;background:#f0fdf4;border-left:4px solid #16a34a;border-radius:6px;">
        <strong>Leggi il contratto per intero</strong> prima di firmare:<br/>
        <a href="${anteprimaUrl}" style="display:inline-block;margin-top:8px;background:#16a34a;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Visualizza contratto</a>
      </p>
      <p style="margin:16px 0;padding:16px;background:#eff6ff;border-left:4px solid #1e4d8c;border-radius:6px;">
        Dopo averlo letto, firma il contratto <strong>online con dito o penna</strong>:<br/>
        <a href="${firmaUrl}" style="display:inline-block;margin-top:8px;background:#1e4d8c;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Firma contratto</a>
      </p>
      <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari S.R.L.S.</p>
    </div>`;

    await inviaEmail({
      to: email,
      subject: `Contratto d'incarico ${contratto.profilo} — Abbraccio Cure Domiciliari`,
      html,
      attachments: [{
        filename: `contratto-incarico-${contratto.profilo.toLowerCase().replace(/\s+/g, '-')}.html`,
        content: Buffer.from(htmlContratto, 'utf-8'),
        contentType: 'text/html',
      }],
    });

    return res.json({ message: 'Email inviata con successo' });
  } catch (error: any) {
    console.error('[Contratti pazienti invia-email] Errore:', error);
    return res.status(500).json({ message: "Errore nell'invio dell'email", error: error.message });
  }
});

// POST /api/contratti-pazienti/firma/:token — salva firma
router.post('/firma/:token', async (req: Request, res: Response) => {
  try {
    const { firmaImg, nome, luogoFirma } = req.body;
    if (!firmaImg) return res.status(400).json({ message: 'Firma obbligatoria' });

    const contratto = await ContrattoPaziente.findOne({ token: req.params.token });
    if (!contratto) return res.status(404).json({ message: 'Link non valido' });
    if (contratto.stato === 'firmato') return res.status(400).json({ message: 'Contratto già firmato' });

    const paziente = await Patient.findById(contratto.patient);
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });

    contratto.firmaImg = firmaImg;
    contratto.nome = nome || `${paziente.firstName} ${paziente.lastName}`;
    contratto.luogoFirma = luogoFirma || 'Roma';
    contratto.dataFirma = new Date();
    contratto.stato = 'firmato';

    const pazienteNorm = normalizzaPaziente(paziente);
    const htmlFirmato = generaHtmlContratto(contratto, pazienteNorm, true, firmaImg);

    contratto.htmlFirmato = htmlFirmato;
    await contratto.save();

    await PatientDocument.create({
      patient: paziente._id,
      category: 'contratto_incarico',
      title: `Contratto d'incarico ${contratto.profilo} — firmato`,
      description: `Contratto d'incarico per reclutamento ${contratto.profilo}. Firmato il ${new Date().toLocaleDateString('it-IT')}.`,
      fileName: `contratto-incarico-${contratto.profilo.toLowerCase()}-${new Date().toISOString().split('T')[0]}.html`,
      contentType: 'text/html',
      data: Buffer.from(htmlFirmato, 'utf-8'),
      uploadedByNome: contratto.nome || 'Paziente',
    });

    return res.json({ message: 'Contratto firmato e archiviato correttamente' });
  } catch (error: any) {
    console.error('[Contratti pazienti firma] Errore:', error);
    return res.status(500).json({ message: 'Errore salvataggio firma', error: error.message });
  }
});

export default router;
