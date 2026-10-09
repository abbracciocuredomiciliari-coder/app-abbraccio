import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import ContrattoPaziente from '../models/ContrattoPaziente';
import Patient from '../models/Patient';
import PatientDocument from '../models/PatientDocument';
import DocumentoFatturazione from '../models/DocumentoFatturazione';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authorizeRole } from '../middleware/roles';
import { auditLog } from '../middleware/audit';
import { inviaEmail } from '../utils/email';
import { generaDocumentoPDF } from '../utils/fatturazionePdf';
import { decrypt } from '../utils/encryption';
import ConsensoGDPR from '../models/ConsensoGDPR';

const router = Router();
const RUOLI_GESTIONE = ['admin', 'coordinator', 'direttore'];

// Allegato preventivo caricato manualmente (PDF/immagine), salvato nel documento contratto
const uploadAllegato = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

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
        <p style="font-size:11px;color:#166534;margin:8px 0;background:#dcfce7;padding:8px;border-radius:4px;">
          <strong>Con la presente firma</strong> dichiaro di aver letto e accettato il presente contratto e l'informativa GDPR al trattamento dei dati personali.
        </p>
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
  // Corrispettivo unico (selezione/reclutamento + collocamento a buon fine): default €250 + IVA
  const importo1 = Number(contratto.importo || 250).toFixed(2).replace('.', ',');
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
        <p style="font-size:11px;color:#166534;margin:8px 0;background:#dcfce7;padding:8px;border-radius:4px;">
          <strong>Con la presente firma</strong> dichiaro di aver letto e accettato il presente contratto e l'informativa GDPR al trattamento dei dati personali.
        </p>
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
        <td><strong>Selezione, Reclutamento e Collocamento a buon fine</strong></td>
        <td>Attivazione ricerca, pubblicazione annunci, screening curricula, colloquio di selezione e collocamento a buon fine con sottoscrizione del contratto di lavoro o effettivo inserimento lavorativo della badante selezionata presso la famiglia. Corrispettivo unico dovuto alla firma del presente contratto.</td>
        <td class="price">€ ${importo1}</td>
      </tr>
    </tbody>
  </table>

  <div class="note">
    <strong>Tutela Normativa (Art. 11 D.Lgs. 276/2003):</strong> In conformità alla legge italiana, il servizio erogato nei confronti del lavoratore domestico/badante è a titolo completamente gratuito. Nessuna quota o trattenuta viene richiesta all'assistente familiare. Tutti i corrispettivi per le attività di intermediazione gravano esclusivamente sul Committente.
  </div>

  <div class="section"><p class="section-title">4. GARANZIA DI SOSTITUZIONE</p></div>
  <p>Qualora il rapporto lavorativo con la badante si interrompa entro 30 giorni dall'assunzione per dimissioni o mancato superamento del periodo di prova, l'Agenzia effettuerà una seconda selezione senza l'addebito di ulteriori corrispettivi.</p>

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

function generaHtmlGdpr(paziente: any, opts: {
  nomeFirmatario: string;
  cognomeFirmatario: string;
  dataFirma?: Date;
  luogoFirma?: string;
  firmaImg?: string;
  finalita?: any;
  datiSensibili?: any;
  modalita?: any;
  comunicazioneTerzi?: any;
  versioneInformativa?: string;
  accettato?: boolean;
}) {
  const dataFirma = opts.dataFirma ? new Date(opts.dataFirma) : new Date();
  const dataFmt = dataFirma.toLocaleDateString('it-IT');
  const nascitaFmt = paziente.birthDate ? new Date(paziente.birthDate).toLocaleDateString('it-IT') : '_______________';
  const luogo = opts.luogoFirma || 'Roma';
  const versione = opts.versioneInformativa || 'v2026.1';
  const nomeCompleto = `${opts.nomeFirmatario} ${opts.cognomeFirmatario}`.trim() || `${paziente.firstName} ${paziente.lastName}`;
  const finalita = opts.finalita || { prestazioneSanitaria: true, fatturazione: true, auditInterno: true, ricercaScientifica: false };
  const datiSensibili = opts.datiSensibili || { datiSanitari: true, datiEconomici: true, immagini: false };
  const firmaHtml = opts.firmaImg
    ? `<div style="margin-top:16px;padding:10px 0;border-top:1px dashed #aaa;"><p style="font-size:11px;color:#555;margin:0 0 6px;"><strong>Firma digitale:</strong> ${nomeCompleto} — ${luogo}, ${dataFmt}</p><img src="${opts.firmaImg}" alt="Firma" style="max-width:220px;max-height:80px;border:1px solid #d1d5db;" /></div>`
    : `<div style="margin-top:16px;padding:10px 0;border-top:1px dashed #aaa;"><p style="font-size:11px;color:#555;margin:0 0 6px;"><strong>Firma:</strong> ${nomeCompleto} — ${luogo}, ${dataFmt}</p><div style="border-bottom:1px solid #333;min-height:28px;max-width:280px;"></div></div>`;

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Informativa Privacy e Consenso - ${paziente.firstName} ${paziente.lastName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:10pt;line-height:1.6;color:#111;padding:28px 36px}
    .header{text-align:center;border-bottom:2px solid #1e4d8c;padding-bottom:14px;margin-bottom:18px}
    .header h1{color:#1e4d8c;font-size:12pt;text-transform:uppercase;letter-spacing:0.4px}
    .header p{font-size:9pt;color:#555;margin-top:4px}
    .paziente-box{background:#f0f4ff;border:1px solid #c7d7f0;border-radius:6px;padding:12px 16px;margin-bottom:16px;font-size:9.5pt}
    .paziente-box strong{color:#1e4d8c}
    h2{font-size:9.5pt;color:#1e4d8c;text-transform:uppercase;background:#f0f4ff;border-left:3px solid #1e4d8c;padding:5px 10px;margin:14px 0 8px}
    p{margin-bottom:8px;font-size:9.5pt}
    ul{margin:4px 0 10px 20px}
    ul li{font-size:9.5pt;margin-bottom:4px}
    .highlight{background:#fef3c7;border-left:3px solid #f59e0b;padding:8px 12px;margin:10px 0;font-size:9pt}
    .consenso-box{border:2px solid #1e4d8c;border-radius:6px;padding:16px 20px;margin-top:20px;background:#fafbff}
    .consenso-box h3{color:#1e4d8c;font-size:10pt;margin-bottom:10px}
    .consenso-row{display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid #e5e7eb;gap:20px}
    .cb-group{display:flex;gap:28px;flex-shrink:0;font-size:9pt}
    .cb-group label{display:flex;align-items:center;gap:4px}
    .firma-grid{display:grid;grid-template-columns:1fr 1fr 2fr;gap:16px;margin-top:20px;border-top:1px dashed #aaa;padding-top:16px}
    .firma-field label{display:block;font-size:8pt;color:#666;font-weight:bold;text-transform:uppercase;margin-bottom:5px}
    .firma-field .line{border-bottom:1px solid #333;min-height:28px}
    .footer{text-align:center;font-size:8pt;color:#999;margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb}
    @media print{body{padding:16px}}
  </style>
</head>
<body>

<div class="header">
  <h1>Informativa sul trattamento dei dati personali<br>e di categoria particolare per l'erogazione dei servizi</h1>
  <p>Ai sensi del Regolamento UE 2016/679 (GDPR) e del D.Lgs. 196/2003 — Versione ${versione}</p>
</div>

<div class="paziente-box">
  <strong>Paziente:</strong> ${paziente.firstName} ${paziente.lastName} &nbsp;|&nbsp;
  <strong>Nato/a il:</strong> ${nascitaFmt} &nbsp;|&nbsp;
  <strong>Data firma:</strong> ${dataFmt} &nbsp;|&nbsp;
  <strong>Firmatario:</strong> ${nomeCompleto} (paziente)
</div>

<p>Gent. Sig.ra / Egr. Sig. <strong>${paziente.firstName} ${paziente.lastName}</strong>,<br>
con la presente desideriamo comunicarLe che per l'instaurazione e la gestione del Servizio di assistenza domiciliare integrata, la nostra Società, <strong>Abbraccio Cure Domiciliari</strong>, con sede legale in Roma, Via Di Santa Maria Ausiliatrice 4b, tratterà i Suoi Dati Personali in qualità di Responsabile del trattamento, ai sensi del Regolamento (UE) 2016/679 (GDPR).</p>

<h2>1. Oggetto del Trattamento</h2>
<p>Al fine di poterLe fornire i Servizi, la Società tratterà i seguenti dati:</p>
<ul>
  <li><strong>Dati comuni identificativi:</strong> nome, cognome, indirizzo, telefono, e-mail, residenza, ecc.</li>
  <li><strong>Categorie particolari di dati (art. 9 GDPR):</strong> dati idonei a rivelare lo stato di salute (documentazione sanitaria, cartelle cliniche).</li>
</ul>

<h2>2. Base Giuridica e Finalità del Trattamento</h2>
<p>I Dati saranno trattati, senza necessità di consenso, ai sensi di: art. 6 c.1 lett. b) e c) GDPR; art. 9 c.2 lett. b), h) e j) GDPR. Le finalità sono:</p>
<ul>
  <li>Puntuale adempimento del Servizio affidatoci;</li>
  <li>Adempimento di obblighi di legge connessi al Servizio;</li>
  <li>Gestione del contenzioso ed esercizio dei diritti in sede giudiziaria;</li>
  <li>Collaborazione con pubbliche autorità, prevenzione di atti illeciti.</li>
</ul>
<div class="highlight">Per finalità diverse sarà richiesto un Suo esplicito ulteriore consenso.</div>

<h2>3. Modalità del Trattamento</h2>
<p>Il trattamento potrà avvenire mediante supporto cartaceo, informatico o telefonico, nel rispetto dei principi di liceità, correttezza e trasparenza, con misure adeguate di sicurezza (pseudonimizzazione, crittografia, controllo accessi).</p>

<h2>4. Comunicazione dei Dati</h2>
<p>I dati potranno essere comunicati a: enti pubblici (ASL, Ospedali, INAIL, INPS ecc.); farmacie, medici specialisti, professionisti sanitari; società di manutenzione tecnica; aziende di credito/assicurazione; consulenti legali, fiscali, amministrativi.</p>

<h2>5. Conservazione</h2>
<p>I dati saranno conservati <strong>non oltre 10 anni dalla cessazione del Servizio</strong>, ai sensi degli obblighi di legge vigenti. A fini statistici e storici, ai sensi dell'art. 89 par. 1 GDPR, con adeguate misure di pseudonimizzazione.</p>

<h2>6. I Suoi Diritti (artt. 15–21 GDPR)</h2>
<ul>
  <li><strong>Accesso (art. 15):</strong> ottenere conferma e copia dei dati trattati;</li>
  <li><strong>Rettifica (art. 16):</strong> correggere dati inesatti o incompleti;</li>
  <li><strong>Cancellazione / Oblio (art. 17):</strong> richiedere cancellazione o anonimizzazione;</li>
  <li><strong>Limitazione (art. 18):</strong> limitare il trattamento nei casi previsti;</li>
  <li><strong>Portabilità (art. 20):</strong> ricevere i dati in formato strutturato e leggibile;</li>
  <li><strong>Opposizione (art. 21):</strong> opporsi al trattamento per motivi legittimi;</li>
  <li><strong>Revoca del consenso:</strong> in qualsiasi momento, senza pregiudizio per il trattamento pregresso.</li>
</ul>

<h2>7. Contatti per Esercitare i Diritti e Reclamo al Garante</h2>
<ul>
  <li><strong>Abbraccio Cure Domiciliari:</strong> abbracciocuredomiciliari@gmail.com — Tel. 351 417 5117</li>
  <li><strong>Garante Privacy:</strong> Piazza di Monte Citorio 121, 00186 Roma — garante@gpdp.it — Fax 06-696773785</li>
  <li>Sito web: www.garanteprivacy.it</li>
</ul>

<div class="consenso-box">
  <h3>📋 CONSENSO AL TRATTAMENTO DEI DATI PERSONALI</h3>
  <p style="font-size:9pt;color:#555;margin-bottom:12px;">Preso atto dell'informativa sul trattamento dei dati personali e di categoria particolare per l'erogazione dei servizi sopra indicata:</p>

  <div class="consenso-row">
    <div style="flex:1;font-size:9.5pt">
      Acconsento al trattamento dei miei Dati Personali per le finalità di cui al paragrafo 2 dell'informativa, connesse alla corretta esecuzione del/i Servizio/i richiesto/i.
    </div>
    <div class="cb-group">
      <label><input type="checkbox" ${finalita.prestazioneSanitaria ? 'checked' : ''} disabled /> Acconsento</label>
      <label><input type="checkbox" ${!finalita.prestazioneSanitaria ? 'checked' : ''} disabled /> Non acconsento</label>
    </div>
  </div>

  <div style="margin-top:14px;font-size:9pt;color:#555;">
    <strong>Finalità accettate:</strong> Prestazione sanitaria ${finalita.prestazioneSanitaria ? '✓' : '✗'}, Fatturazione ${finalita.fatturazione ? '✓' : '✗'}, Audit interno ${finalita.auditInterno ? '✓' : '✗'}.<br>
    <strong>Dati sensibili:</strong> Sanitari ${datiSensibili.datiSanitari ? '✓' : '✗'}, Economici ${datiSensibili.datiEconomici ? '✓' : '✗'}, Immagini ${datiSensibili.immagini ? '✓' : '✗'}.
  </div>

  ${opts.accettato ? `<p style="margin-top:12px;font-size:9.5pt;color:#166534;background:#dcfce7;padding:8px 12px;border-radius:4px;"><strong>✅ Consenso prestato elettronicamente</strong> in seguito a lettura dell'informativa, contestualmente alla firma del contratto d'incarico.</p>` : ''}

  ${firmaHtml}
</div>

<div class="footer">
  Abbraccio Cure Domiciliari — Roma, Via Di Santa Maria Ausiliatrice 4b — Tel. 351 417 5117 — abbracciocuredomiciliari@gmail.com<br>
  Versione informativa: ${versione} — Documento generato il ${new Date().toLocaleDateString('it-IT')}
</div>

</body>
</html>`;
}

// POST /api/contratti-pazienti — crea un nuovo contratto d'incarico
router.post('/', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('contratti_pazienti', 'CREATE'), async (req: AuthRequest, res: Response) => {
  try {
    const { patient, profilo, importo, email, preventivoId } = req.body;
    if (!patient || !profilo) return res.status(400).json({ message: 'Paziente e profilo obbligatori' });
    if (!['OSS', 'Infermiere', 'Assistente familiare', 'Operatore generale'].includes(profilo)) return res.status(400).json({ message: 'Profilo non valido' });

    const paziente = await Patient.findById(patient);
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });

    let preventivoRef: any = undefined;
    if (preventivoId) {
      const prev = await DocumentoFatturazione.findOne({ _id: preventivoId, patient, tipo: 'preventivo' }).select('_id');
      if (!prev) return res.status(400).json({ message: 'Preventivo non valido per questo paziente' });
      preventivoRef = prev._id;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const contratto = await ContrattoPaziente.create({
      patient,
      profilo,
      importo: Number(importo) || 150,
      token,
      email: email || paziente.email,
      nome: `${paziente.firstName} ${paziente.lastName}`,
      stato: 'emesso',
      preventivoId: preventivoRef,
    });

    return res.status(201).json(contratto);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore nella creazione del contratto', error: error.message });
  }
});

// POST /api/contratti-pazienti/:id/allegato — carica un file preventivo (PDF/immagine) da allegare alla richiesta firma
router.post('/:id/allegato', authenticateToken, authorizeRole(...RUOLI_GESTIONE), auditLog('contratti_pazienti', 'UPDATE'), uploadAllegato.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const contratto = await ContrattoPaziente.findById(req.params.id);
    if (!contratto) return res.status(404).json({ message: 'Contratto non trovato' });
    if (!req.file) return res.status(400).json({ message: 'File obbligatorio' });

    contratto.allegatoFileName = req.file.originalname;
    contratto.allegatoContentType = req.file.mimetype;
    contratto.allegatoData = req.file.buffer;
    await contratto.save();

    return res.json({ message: 'Allegato caricato', fileName: contratto.allegatoFileName });
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore caricamento allegato', error: error.message });
  }
});

// GET /api/contratti-pazienti/preventivo/:token — download pubblico PDF del preventivo collegato (via token firma)
router.get('/preventivo/:token', async (req: Request, res: Response) => {
  try {
    const contratto = await ContrattoPaziente.findOne({ token: req.params.token });
    if (!contratto) return res.status(404).json({ message: 'Link non valido' });
    if (!contratto.preventivoId) return res.status(404).json({ message: 'Nessun preventivo allegato' });

    const doc = await DocumentoFatturazione.findById(contratto.preventivoId)
      .populate('patient', 'firstName lastName codiceFiscale address email')
      .lean();
    if (!doc) return res.status(404).json({ message: 'Preventivo non trovato' });

    const buffer = await generaDocumentoPDF(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PREVENTIVO-${doc.numero}.pdf"`);
    return res.send(buffer);
  } catch (error: any) {
    console.error('[Contratti pazienti preventivo] Errore:', error);
    return res.status(500).json({ message: 'Errore generazione PDF preventivo', error: error.message });
  }
});

// GET /api/contratti-pazienti/allegato/:token — download pubblico del file preventivo caricato (via token firma)
router.get('/allegato/:token', async (req: Request, res: Response) => {
  try {
    const contratto = await ContrattoPaziente.findOne({ token: req.params.token });
    if (!contratto) return res.status(404).json({ message: 'Link non valido' });
    if (!contratto.allegatoData) return res.status(404).json({ message: 'Nessun allegato' });

    res.setHeader('Content-Type', contratto.allegatoContentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${contratto.allegatoFileName || 'allegato'}"`);
    return res.send(contratto.allegatoData);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore download allegato', error: error.message });
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
      hasPreventivo: !!contratto.preventivoId,
      hasAllegato: !!contratto.allegatoData,
      allegatoFileName: contratto.allegatoFileName || '',
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
    const htmlGdpr = generaHtmlGdpr(pazienteNorm, {
      nomeFirmatario: contratto.nome || `${pazienteNorm.firstName} ${pazienteNorm.lastName}`,
      cognomeFirmatario: '',
      versioneInformativa: 'v2026.1',
      finalita: { prestazioneSanitaria: true, fatturazione: true, auditInterno: true, ricercaScientifica: false },
      datiSensibili: { datiSanitari: true, datiEconomici: true, immagini: false },
      modalita: { cartaceo: true, informatico: true, telefonico: true },
      comunicazioneTerzi: { mediciSpecialisti: false, struttureSanitarie: false, familiari: false, assicurazioni: false },
      accettato: false,
    });

    const frontendUrl = process.env.FRONTEND_URL || 'https://app.abbracciocuredomiciliari.it';
    const apiProtocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const apiHost = req.get('host') || 'api.abbracciocuredomiciliari.it';
    const anteprimaUrl = `${apiProtocol}://${apiHost}/api/contratti-pazienti/anteprima/${contratto.token}`;
    const gdprUrl = `${apiProtocol}://${apiHost}/api/contratti-pazienti/gdpr/${contratto.token}`;
    const firmaUrl = `${frontendUrl}/firma-contratto-paziente?token=${contratto.token}`;
    const preventivoUrl = contratto.preventivoId ? `${apiProtocol}://${apiHost}/api/contratti-pazienti/preventivo/${contratto.token}` : '';
    const allegatoUrl = contratto.allegatoData ? `${apiProtocol}://${apiHost}/api/contratti-pazienti/allegato/${contratto.token}` : '';

    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
      <h2 style="color:#1e4d8c;margin-top:0;">Contratto d'incarico e informativa GDPR</h2>
      <p>Gentile <strong>${pazienteNorm.firstName || ''} ${pazienteNorm.lastName || ''}</strong>,</p>
      <p>in allegato trovi il contratto d'incarico completo e l'informativa GDPR${(preventivoUrl || allegatoUrl) ? ', insieme al documento preventivo,' : ''} per l'attività di reclutamento del profilo <strong>${contratto.profilo}</strong>.</p>
      <p style="margin:16px 0;padding:16px;background:#f0fdf4;border-left:4px solid #16a34a;border-radius:6px;">
        <strong>Leggi entrambi i documenti</strong> prima di firmare:<br/>
        <a href="${anteprimaUrl}" style="display:inline-block;margin-top:8px;background:#16a34a;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Visualizza contratto</a>
        <a href="${gdprUrl}" style="display:inline-block;margin-top:8px;margin-left:8px;background:#16a34a;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Visualizza GDPR</a>
      </p>
      ${(preventivoUrl || allegatoUrl) ? `<p style="margin:16px 0;padding:16px;background:#fffbeb;border-left:4px solid #d97706;border-radius:6px;">
        <strong>Documento preventivo allegato</strong> — scaricalo in formato PDF:<br/>
        ${preventivoUrl ? `<a href="${preventivoUrl}" style="display:inline-block;margin-top:8px;background:#d97706;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Scarica preventivo (PDF)</a>` : ''}
        ${allegatoUrl ? `<a href="${allegatoUrl}" style="display:inline-block;margin-top:8px;${preventivoUrl ? 'margin-left:8px;' : ''}background:#d97706;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Scarica allegato${contratto.allegatoFileName ? ` (${contratto.allegatoFileName})` : ''}</a>` : ''}
      </p>` : ''}
      <p style="margin:16px 0;padding:16px;background:#eff6ff;border-left:4px solid #1e4d8c;border-radius:6px;">
        Dopo averli letti, firma contratto e consenso <strong>online con dito o penna</strong>:<br/>
        <a href="${firmaUrl}" style="display:inline-block;margin-top:8px;background:#1e4d8c;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Firma contratto e consenso</a>
      </p>
      <p style="margin-top:24px;font-size:12px;color:#888;">Abbraccio Cure Domiciliari S.R.L.S.</p>
    </div>`;

    const attachments: { filename: string; content?: Buffer; contentType?: string }[] = [
      {
        filename: `contratto-incarico-${contratto.profilo.toLowerCase().replace(/\s+/g, '-')}.html`,
        content: Buffer.from(htmlContratto, 'utf-8'),
        contentType: 'text/html',
      },
      {
        filename: `informativa-gdpr.html`,
        content: Buffer.from(htmlGdpr, 'utf-8'),
        contentType: 'text/html',
      },
    ];
    if (contratto.preventivoId) {
      const docPrev = await DocumentoFatturazione.findById(contratto.preventivoId)
        .populate('patient', 'firstName lastName codiceFiscale address email')
        .lean();
      if (docPrev) {
        attachments.push({
          filename: `PREVENTIVO-${docPrev.numero}.pdf`,
          content: await generaDocumentoPDF(docPrev),
          contentType: 'application/pdf',
        });
      }
    }
    if (contratto.allegatoData) {
      attachments.push({
        filename: contratto.allegatoFileName || 'allegato',
        content: contratto.allegatoData,
        contentType: contratto.allegatoContentType || 'application/octet-stream',
      });
    }

    await inviaEmail({
      to: email,
      subject: `Contratto d'incarico e GDPR ${contratto.profilo} — Abbraccio Cure Domiciliari`,
      html,
      attachments,
    });

    return res.json({ message: 'Email inviata con successo' });
  } catch (error: any) {
    console.error('[Contratti pazienti invia-email] Errore:', error);
    return res.status(500).json({ message: "Errore nell'invio dell'email", error: error.message });
  }
});

// GET /api/contratti-pazienti/gdpr/:token — anteprima pubblica informativa GDPR (lettura prima della firma)
router.get('/gdpr/:token', async (req: Request, res: Response) => {
  try {
    const contratto = await ContrattoPaziente.findOne({ token: req.params.token })
      .populate('patient', 'firstName lastName birthDate');
    if (!contratto) return res.status(404).json({ message: 'Link non valido' });

    const paziente = normalizzaPaziente(contratto.patient);
    const html = generaHtmlGdpr(paziente, {
      nomeFirmatario: contratto.nome || `${paziente.firstName} ${paziente.lastName}`,
      cognomeFirmatario: '',
      versioneInformativa: 'v2026.1',
      finalita: { prestazioneSanitaria: true, fatturazione: true, auditInterno: true, ricercaScientifica: false },
      datiSensibili: { datiSanitari: true, datiEconomici: true, immagini: false },
      modalita: { cartaceo: true, informatico: true, telefonico: true },
      comunicazioneTerzi: { mediciSpecialisti: false, struttureSanitarie: false, familiari: false, assicurazioni: false },
      accettato: false,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (error: any) {
    return res.status(500).json({ message: 'Errore generazione anteprima GDPR', error: error.message });
  }
});

// POST /api/contratti-pazienti/firma/:token — salva firma
router.post('/firma/:token', async (req: Request, res: Response) => {
  try {
    const { firmaImg, nome, luogoFirma, gdprAccettato } = req.body;
    if (!gdprAccettato) return res.status(400).json({ message: 'È obbligatorio accettare l\'informativa GDPR e il contratto prima di firmare.' });
    if (!firmaImg) return res.status(400).json({ message: 'Firma obbligatoria' });

    const contratto = await ContrattoPaziente.findOne({ token: req.params.token });
    if (!contratto) return res.status(404).json({ message: 'Link non valido' });
    if (contratto.stato === 'firmato') return res.status(400).json({ message: 'Contratto già firmato' });

    const paziente = await Patient.findById(contratto.patient);
    if (!paziente) return res.status(404).json({ message: 'Paziente non trovato' });

    const nomeFirmatario = nome || `${paziente.firstName} ${paziente.lastName}`;
    const luogo = luogoFirma || 'Roma';
    const dataFirma = new Date();

    contratto.firmaImg = firmaImg;
    contratto.nome = nomeFirmatario;
    contratto.luogoFirma = luogo;
    contratto.dataFirma = dataFirma;
    contratto.stato = 'firmato';
    contratto.gdprAccettato = true;

    const pazienteNorm = normalizzaPaziente(paziente);
    const htmlFirmato = generaHtmlContratto(contratto, pazienteNorm, true, firmaImg);

    // Genera l'informativa GDPR firmata con la stessa firma
    const nomeParts = nomeFirmatario.split(' ').filter(Boolean);
    const nomeF = nomeParts.slice(0, -1).join(' ') || nomeFirmatario;
    const cognomeF = nomeParts.slice(-1)[0] || '';
    const gdprHtmlFirmato = generaHtmlGdpr(pazienteNorm, {
      nomeFirmatario: nomeF,
      cognomeFirmatario: cognomeF,
      dataFirma,
      luogoFirma: luogo,
      firmaImg,
      finalita: { prestazioneSanitaria: true, fatturazione: true, auditInterno: true, ricercaScientifica: false },
      datiSensibili: { datiSanitari: true, datiEconomici: true, immagini: false },
      modalita: { cartaceo: true, informatico: true, telefonico: true },
      comunicazioneTerzi: { mediciSpecialisti: false, struttureSanitarie: false, familiari: false, assicurazioni: false },
      versioneInformativa: 'v2026.1',
      accettato: true,
    });
    contratto.gdprHtmlFirmato = gdprHtmlFirmato;

    // Crea il consenso GDPR archiviato
    const firmaHash = crypto.createHash('sha256').update(firmaImg).digest('hex');
    const consenso = await ConsensoGDPR.create({
      patientId: String(paziente._id),
      pazienteAnonimoId: crypto.randomUUID(),
      finalita: { prestazioneSanitaria: true, fatturazione: true, auditInterno: true, ricercaScientifica: false },
      modalita: { cartaceo: true, informatico: true, telefonico: true },
      datiSensibili: { datiSanitari: true, datiEconomici: true, immagini: false },
      comunicazioneTerzi: { mediciSpecialisti: false, struttureSanitarie: false, familiari: false, assicurazioni: false },
      firmatoDa: 'paziente',
      nomeFirmatario: nomeF,
      cognomeFirmatario: cognomeF,
      codiceFiscaleFirmatario: pazienteNorm.codiceFiscale || '',
      firmaDigitale: firmaHash,
      dataFirma,
      luogoFirma: luogo,
      versioneInformativa: 'v2026.1',
      htmlFirmato: gdprHtmlFirmato,
      revocato: false,
      operatoreId: 'firma_contratto',
      operatoreEmail: 'firma@abbracciocuredomiciliari.it',
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent']?.substring(0, 200),
      inviiEmail: [],
    });
    contratto.consensoGdprId = String(consenso._id);

    contratto.htmlFirmato = htmlFirmato;
    await contratto.save();

    await PatientDocument.create({
      patient: paziente._id,
      category: 'contratto_incarico',
      title: `Contratto d'incarico ${contratto.profilo} — firmato`,
      description: `Contratto d'incarico per reclutamento ${contratto.profilo}. Firmato il ${dataFirma.toLocaleDateString('it-IT')}.`,
      fileName: `contratto-incarico-${contratto.profilo.toLowerCase()}-${dataFirma.toISOString().split('T')[0]}.html`,
      contentType: 'text/html',
      data: Buffer.from(htmlFirmato, 'utf-8'),
      uploadedByNome: contratto.nome || 'Paziente',
    });

    // Archivia anche il GDPR firmato come documento paziente
    await PatientDocument.create({
      patient: paziente._id,
      category: 'consenso_gdpr',
      title: `Consenso GDPR — firmato (contratto ${contratto.profilo})`,
      description: `Consenso GDPR prestato contestualmente alla firma del contratto d'incarico il ${dataFirma.toLocaleDateString('it-IT')}.`,
      fileName: `consenso-gdpr-${dataFirma.toISOString().split('T')[0]}.html`,
      contentType: 'text/html',
      data: Buffer.from(gdprHtmlFirmato, 'utf-8'),
      uploadedByNome: contratto.nome || 'Paziente',
    });

    return res.json({ message: 'Contratto e consenso GDPR firmati e archiviati correttamente', consensoGdprId: consenso._id });
  } catch (error: any) {
    console.error('[Contratti pazienti firma] Errore:', error);
    return res.status(500).json({ message: 'Errore salvataggio firma', error: error.message });
  }
});

export default router;
