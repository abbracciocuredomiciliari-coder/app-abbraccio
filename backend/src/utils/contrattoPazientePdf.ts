import PDFDocument from 'pdfkit';

// Costanti aziendali condivise con i template HTML dei contratti pazienti
export const AZIENDA = {
  nome: process.env.AZIENDA_NOME || 'ABBRACCIO CURE DOMICILIARI S.R.L.S.',
  indirizzo: process.env.AZIENDA_INDIRIZZO || 'ROMA (RM) VIA DI S MARIA AUSILIATRICE 4B',
  capCitta: process.env.AZIENDA_CAP_CITTA || 'CAP 00181',
  pec: process.env.AZIENDA_PEC || 'abbracciocuredomiciliari@facilepec.com',
  rea: process.env.AZIENDA_REA || 'RM - 1777027',
  cf: process.env.AZIENDA_CF || '18316251000',
  piva: process.env.AZIENDA_PIVA || 'P.IVA da configurare',
};

const BLU = '#1e4d8c';
const VERDE = '#166534';
const GRIGIO = '#555555';
const MARGINE = 50;
const LARGHEZZA = 545; // A4 (595) - 2*margini

function fmtData(d: any) {
  if (!d) return '_______________';
  try { return new Date(d).toLocaleDateString('it-IT'); } catch { return String(d); }
}

function fmtEuro(n: number) {
  return `€ ${n.toFixed(2).replace('.', ',')}`;
}

function nuovoDoc(): InstanceType<typeof PDFDocument> {
  return new PDFDocument({ size: 'A4', margin: MARGINE, info: { Author: AZIENDA.nome } });
}

function docToBuffer(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

// Barra titolo sezione blu (come .section nei template HTML)
function sezione(doc: InstanceType<typeof PDFDocument>, titolo: string) {
  if (doc.y > 740) doc.addPage();
  const y = doc.y + 6;
  doc.rect(MARGINE, y, LARGHEZZA, 20).fill('#eef3f7');
  doc.rect(MARGINE, y, 4, 20).fill(BLU);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(BLU).text(titolo, MARGINE + 12, y + 5, { width: LARGHEZZA - 24 });
  doc.y = y + 26;
}

function testo(doc: InstanceType<typeof PDFDocument>, t: string, opts: any = {}) {
  if (doc.y > 750) doc.addPage();
  doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size || 9.5)
    .fillColor(opts.color || '#111111')
    .text(t, MARGINE, doc.y, { width: LARGHEZZA, lineGap: 2, ...(opts.textOpts || {}) });
  doc.moveDown(opts.gap !== undefined ? opts.gap : 0.35);
}

function bullet(doc: InstanceType<typeof PDFDocument>, t: string) {
  if (doc.y > 750) doc.addPage();
  doc.font('Helvetica').fontSize(9.5).fillColor('#111111')
    .text(`•  ${t}`, MARGINE + 12, doc.y, { width: LARGHEZZA - 12, lineGap: 2 });
  doc.moveDown(0.2);
}

function campo(doc: InstanceType<typeof PDFDocument>, label: string, valore: string) {
  if (doc.y > 750) doc.addPage();
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#475569').text(label.toUpperCase(), MARGINE, y, { width: 150 });
  doc.font('Helvetica').fontSize(9.5).fillColor('#111111').text(valore || '_______________', MARGINE + 155, y - 1, { width: LARGHEZZA - 155 });
  doc.moveTo(MARGINE, doc.y + 2).lineTo(MARGINE + LARGHEZZA, doc.y + 2).strokeColor('#cbd5e1').lineWidth(0.6).stroke();
  doc.moveDown(0.5);
}

function headerAzienda(doc: InstanceType<typeof PDFDocument>, titolo: string, sottotitolo?: string) {
  doc.rect(0, 0, 595, 78).fill(BLU);
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#ffffff').text(AZIENDA.nome, MARGINE, 16, { width: LARGHEZZA });
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#ffffff').text(titolo, MARGINE, 38, { width: LARGHEZZA });
  if (sottotitolo) {
    doc.font('Helvetica').fontSize(8).fillColor('#dbeafe').text(sottotitolo, MARGINE, 54, { width: LARGHEZZA });
  }
  doc.y = 92;
}

function footer(doc: InstanceType<typeof PDFDocument>) {
  const y = 800;
  doc.moveTo(MARGINE, y).lineTo(MARGINE + LARGHEZZA, y).strokeColor('#cbd5e1').lineWidth(0.6).stroke();
  doc.font('Helvetica').fontSize(7.5).fillColor(GRIGIO)
    .text(`Documento generato elettronicamente da ${AZIENDA.nome} — ${new Date().toLocaleString('it-IT')}`, MARGINE, y + 6, { width: LARGHEZZA, align: 'center' });
}

// Inserisce la firma digitale (data URL base64 PNG) se presente
function bloccoFirma(doc: InstanceType<typeof PDFDocument>, nome: string, luogo: string, data: string, firmaImg?: string) {
  if (doc.y > 690) doc.addPage();
  doc.moveDown(0.6);
  sezione(doc, 'CONFERMA DI FIRMA');
  testo(doc, `Luogo e data: ${luogo}, ${data}`, { size: 9 });
  testo(doc, `Firmatario: ${nome}`, { size: 9 });
  testo(doc, 'Con la presente firma dichiaro di aver letto e accettato il presente contratto e l\'informativa GDPR al trattamento dei dati personali.', { size: 8.5, color: VERDE });
  if (firmaImg && firmaImg.startsWith('data:image')) {
    try {
      const base64 = firmaImg.split(',')[1];
      const img = Buffer.from(base64, 'base64');
      if (doc.y > 700) doc.addPage();
      doc.image(img, MARGINE, doc.y + 4, { width: 170 });
      doc.y += 60;
    } catch { /* firma non renderizzabile: la si omette dal PDF */ }
  }
}

// ─── PDF mandato intermediazione (Assistente familiare) ───────────────────────
async function pdfMandatoBadante(contratto: any, paziente: any): Promise<Buffer> {
  const doc = nuovoDoc();
  const importoNetto = Number(contratto.importo || 250);
  const iva = Math.round(importoNetto * 0.22 * 100) / 100;
  const totaleIvato = Math.round((importoNetto + iva) * 100) / 100;
  const luogo = contratto.luogoFirma || 'Roma';
  const data = contratto.dataFirma ? new Date(contratto.dataFirma).toLocaleDateString('it-IT') : fmtData(new Date());
  const nomeCompleto = `${paziente.firstName} ${paziente.lastName}`;

  headerAzienda(doc, 'MANDATO DI RICERCA, SELEZIONE E INTERMEDIAZIONE PERSONALE',
    `Sede Legale: ${AZIENDA.indirizzo} — ${AZIENDA.capCitta}   |   C.F./P.IVA: ${AZIENDA.cf}   |   REA: ${AZIENDA.rea}   |   PEC: ${AZIENDA.pec}`);

  sezione(doc, '1. PARTI CONTRAENTI');
  testo(doc, `Tra la Società ${AZIENDA.nome} (di seguito "Agenzia"), con i dati sociali in epigrafe, e il sottoscritto Committente (Famiglia / Datore di lavoro):`);
  campo(doc, 'Nome e Cognome', nomeCompleto);
  campo(doc, 'Codice Fiscale', paziente.codiceFiscale || '');
  campo(doc, 'Data di Nascita', fmtData(paziente.birthDate));
  campo(doc, 'Indirizzo Residenza', paziente.address || '');
  campo(doc, 'Telefono / Cellulare', paziente.contactPhone || '');
  campo(doc, 'Email', paziente.email || '');

  sezione(doc, "2. OGGETTO DELL'INCARICO E MODALITÀ DI ESECUZIONE");
  testo(doc, "Il Committente conferisce all'Agenzia l'incarico professionale finalizzato alla ricerca, screening, valutazione e selezione di un assistente familiare (badante / colf / assistente domiciliare) rispondente alle esigenze assistenziali della famiglia. L'Agenzia si impegna a sottoporre al Committente i profili idonei e coordinare i colloqui conoscitivi.");

  sezione(doc, '3. CORRISPETTIVO ECONOMICO E MODALITÀ DI PAGAMENTO');
  testo(doc, "A fronte delle prestazioni svolte, il Committente si obbliga a corrispondere all'Agenzia le seguenti competenze:", { gap: 0.6 });

  // Tabella corrispettivo
  const tY = doc.y;
  const cw = [170, 245, 130];
  doc.rect(MARGINE, tY, LARGHEZZA, 18).fill(BLU);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff')
    .text('Fase del Servizio', MARGINE + 6, tY + 5, { width: cw[0] - 12 });
  doc.text('Descrizione Prestazione', MARGINE + cw[0] + 6, tY + 5, { width: cw[1] - 12 });
  doc.text('Importo (oltre IVA)', MARGINE + cw[0] + cw[1] + 6, tY + 5, { width: cw[2] - 12, align: 'right' });
  let rowY = tY + 18;
  const descVoce = 'Attivazione ricerca, pubblicazione annunci, screening curricula, colloquio di selezione e collocamento a buon fine con sottoscrizione del contratto di lavoro o effettivo inserimento lavorativo della badante selezionata presso la famiglia. Corrispettivo unico dovuto alla firma del presente contratto.';
  const hDesc = doc.heightOfString(descVoce, { width: cw[1] - 12 });
  const hRow = Math.max(30, hDesc + 10);
  doc.rect(MARGINE, rowY, LARGHEZZA, hRow).stroke('#cbd5e1');
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111111')
    .text('Selezione, Reclutamento e Collocamento a buon fine', MARGINE + 6, rowY + 5, { width: cw[0] - 12 });
  doc.font('Helvetica').fontSize(8).text(descVoce, MARGINE + cw[0] + 6, rowY + 5, { width: cw[1] - 12, lineGap: 1.5 });
  doc.font('Helvetica-Bold').fontSize(9).text(fmtEuro(importoNetto), MARGINE + cw[0] + cw[1] + 6, rowY + 5, { width: cw[2] - 12, align: 'right' });
  rowY += hRow;
  // Riepilogo IVA
  const righeRiepilogo: [string, string, boolean][] = [
    ['Imponibile', fmtEuro(importoNetto), false],
    ['IVA 22%', fmtEuro(iva), false],
    ['TOTALE IVA INCLUSA', fmtEuro(totaleIvato), true],
  ];
  for (const [lbl, val, bold] of righeRiepilogo) {
    doc.rect(MARGINE, rowY, LARGHEZZA, 16).fillAndStroke(bold ? '#f0fdf4' : '#ffffff', '#cbd5e1');
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10 : 8.5)
      .fillColor(bold ? VERDE : '#111111')
      .text(lbl, MARGINE + 6, rowY + 4, { width: cw[0] + cw[1] - 12, align: 'right' });
    doc.text(val, MARGINE + cw[0] + cw[1] + 6, rowY + 4, { width: cw[2] - 12, align: 'right' });
    rowY += 16;
  }
  doc.y = rowY + 10;

  // Nota tutela normativa
  const notaY = doc.y;
  doc.font('Helvetica').fontSize(8.5);
  const hNota = doc.heightOfString('Tutela Normativa (Art. 11 D.Lgs. 276/2003): In conformità alla legge italiana, il servizio erogato nei confronti del lavoratore domestico/badante è a titolo completamente gratuito. Nessuna quota o trattenuta viene richiesta all\'assistente familiare. Tutti i corrispettivi per le attività di intermediazione gravano esclusivamente sul Committente.', { width: LARGHEZZA - 20 });
  doc.rect(MARGINE, notaY, LARGHEZZA, hNota + 12).fill('#f0fdf4');
  doc.rect(MARGINE, notaY, 4, hNota + 12).fill('#16a34a');
  doc.fillColor(VERDE).text('Tutela Normativa (Art. 11 D.Lgs. 276/2003): In conformità alla legge italiana, il servizio erogato nei confronti del lavoratore domestico/badante è a titolo completamente gratuito. Nessuna quota o trattenuta viene richiesta all\'assistente familiare. Tutti i corrispettivi per le attività di intermediazione gravano esclusivamente sul Committente.', MARGINE + 10, notaY + 6, { width: LARGHEZZA - 20, lineGap: 1.5 });
  doc.y = notaY + hNota + 18;

  sezione(doc, '4. GARANZIA DI SOSTITUZIONE');
  testo(doc, "Qualora il rapporto lavorativo con la badante si interrompa entro 30 giorni dall'assunzione per dimissioni o mancato superamento del periodo di prova, l'Agenzia effettuerà una seconda selezione senza l'addebito di ulteriori corrispettivi.");

  doc.moveDown(0.8);
  testo(doc, `Luogo e Data: ${luogo}, lì ${data}`, { bold: true, gap: 1.2 });

  // Righe firma
  if (doc.y > 700) doc.addPage();
  const sY = doc.y;
  doc.moveTo(MARGINE, sY + 40).lineTo(MARGINE + 250, sY + 40).strokeColor('#94a3b8').lineWidth(0.8).stroke();
  doc.moveTo(MARGINE + 295, sY + 40).lineTo(MARGINE + LARGHEZZA, sY + 40).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(GRIGIO)
    .text('Firma del Committente (Famiglia)', MARGINE, sY + 46, { width: 250, align: 'center' });
  doc.text(`Per ${AZIENDA.nome} (Legale Rappresentante: SCHEMBRI SIMONA)`, MARGINE + 295, sY + 46, { width: 250, align: 'center' });
  doc.y = sY + 80;

  // Approvazione specifica clausole
  if (doc.y > 700) doc.addPage();
  const bY = doc.y;
  doc.rect(MARGINE, bY, LARGHEZZA, 78).stroke('#cbd5e1');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111').text('APPROVAZIONE SPECIFICA CLAUSOLE', MARGINE + 12, bY + 10, { width: LARGHEZZA - 24 });
  doc.font('Helvetica').fontSize(8.5).fillColor('#333333')
    .text("Ai sensi e per gli effetti degli artt. 1341 e 1342 c.c., il Committente dichiara di approvare specificamente le clausole di cui all'art. 3 (Corrispettivo Economico), art. 3-bis (Gratuità per il Lavoratore ex D.Lgs. 276/2003) e art. 4 (Garanzia di Sostituzione).", MARGINE + 12, bY + 26, { width: LARGHEZZA - 24, lineGap: 1.5 });
  doc.moveTo(MARGINE + 12, bY + 66).lineTo(MARGINE + 320, bY + 66).strokeColor('#94a3b8').stroke();
  doc.font('Helvetica').fontSize(7.5).fillColor(GRIGIO).text('Firma del Committente per specifica approvazione', MARGINE + 12, bY + 69, { width: 300 });
  doc.y = bY + 90;

  if (contratto.stato === 'firmato' && contratto.firmaImg) {
    bloccoFirma(doc, contratto.nome || nomeCompleto, luogo, data, contratto.firmaImg);
  }
  footer(doc);
  return docToBuffer(doc);
}

// ─── PDF contratto d'incarico generico (OSS / Infermiere / Operatore generale) ─
async function pdfContrattoGenerico(contratto: any, paziente: any): Promise<Buffer> {
  const doc = nuovoDoc();
  const importo = Number(contratto.importo || 150);
  const luogo = contratto.luogoFirma || 'Roma';
  const data = contratto.dataFirma ? new Date(contratto.dataFirma).toLocaleDateString('it-IT') : fmtData(new Date());
  const nomeCompleto = `${paziente.firstName} ${paziente.lastName}`;

  headerAzienda(doc, "CONTRATTO D'INCARICO E IMPEGNO DI RECLUTAMENTO",
    `Assistenza domiciliare sanitaria, socio-sanitaria e familiare   |   Sede: ${AZIENDA.indirizzo} — ${AZIENDA.capCitta}   |   PEC: ${AZIENDA.pec}`);

  sezione(doc, '1. PARTI CONTRAENTI');
  testo(doc, `Tra la Società ${AZIENDA.nome} (di seguito "Agenzia") e il sottoscritto Committente:`);
  campo(doc, 'Nome e Cognome', nomeCompleto);
  campo(doc, 'Codice Fiscale', paziente.codiceFiscale || '');
  campo(doc, 'Data di Nascita', fmtData(paziente.birthDate));
  campo(doc, 'Indirizzo di Residenza', paziente.address || '');
  campo(doc, 'Telefono / Cellulare', paziente.contactPhone || '');
  campo(doc, 'Email', paziente.email || '');

  sezione(doc, "2. OGGETTO DELL'INCARICO SPECIALISTICO");
  testo(doc, "Il Committente conferisce all'Agenzia l'incarico professionale finalizzato all'avvio immediato delle attività di reclutamento, screening dei curricula, verifica dei titoli abilitanti e selezione del seguente profilo professionale sanitario/socio-sanitario per assistenza domiciliare:");
  testo(doc, `Profilo richiesto: ${contratto.profilo}`, { bold: true });

  sezione(doc, "3. CORRISPETTIVO D'AVVIO, CONDIZIONI E SCAVALCO COSTI");
  testo(doc, `Diritti di Avvio Ricerca e Reclutamento: ${fmtEuro(importo)} (oltre IVA)`, { bold: true, color: VERDE });
  testo(doc, 'Importo versato contestualmente alla firma del presente contratto a copertura dei costi operativi di ricerca, valutazione dei titoli professionali e colloquio selettivo del personale proposto.');
  testo(doc, `COMPENSAZIONE E SCALAVECCHIA / SCALAVECCHIO DEL CORRISPETTIVO: In caso di accettazione del profilo proposto e di effettivo avvio dell'assistenza domiciliare, l'importo di ${fmtEuro(importo)} già versato verrà interamente scalato/scomputato dal costo totale del servizio di assistenza o dal saldo finale dovuto all'Agenzia per il collocamento.`);
  // Clausola rinuncia (warning)
  const wY = doc.y;
  const wTxt = `CLAUSOLA DI RINUNCIA (TRATTENUTA): Qualora il Committente decida di rinunciare all'incarico o recedere dal contratto dopo che l'Agenzia ha svolto la ricerca ed individuato un lavoratore (O.S.S., Infermiere, Assistente familiare o Badante/colf) idoneo e rispondente ai requisiti, l'importo di ${fmtEuro(importo)} non verrà restituito e sarà trattenuto a titolo di compenso per le attività istruttorie e lavorative svolte.`;
  doc.font('Helvetica').fontSize(8.5);
  const hW = doc.heightOfString(wTxt, { width: LARGHEZZA - 20 });
  doc.rect(MARGINE, wY, LARGHEZZA, hW + 12).fill('#fef2f2');
  doc.rect(MARGINE, wY, 4, hW + 12).fill('#dc2626');
  doc.fillColor('#7f1d1d').text(wTxt, MARGINE + 10, wY + 6, { width: LARGHEZZA - 20, lineGap: 1.5 });
  doc.y = wY + hW + 18;

  sezione(doc, '4. DURATA E RECESSO');
  testo(doc, 'Il presente contratto ha durata dalla data di sottoscrizione sino all\'effettivo avvio del servizio di assistenza domiciliare, comunque non oltre 12 mesi. Ciascuna parte potrà recedere con preavviso scritto di 30 giorni, salvo quanto previsto dalla clausola di rinuncia.');

  sezione(doc, '5. TRATTAMENTO DATI');
  testo(doc, 'I dati personali saranno trattati nel rispetto del Regolamento UE 2016/679 e delle norme nazionali vigenti, esclusivamente per le finalità di reclutamento e gestione del servizio richiesto.');

  doc.moveDown(0.8);
  testo(doc, `Letto, confermato e sottoscritto in ${luogo} il ${data}.`, { bold: true, gap: 1.2 });
  if (doc.y > 700) doc.addPage();
  const sY = doc.y;
  doc.moveTo(MARGINE, sY + 40).lineTo(MARGINE + 250, sY + 40).strokeColor('#94a3b8').lineWidth(0.8).stroke();
  doc.moveTo(MARGINE + 295, sY + 40).lineTo(MARGINE + LARGHEZZA, sY + 40).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(GRIGIO)
    .text('Timbro e firma Agenzia', MARGINE, sY + 46, { width: 250, align: 'center' });
  doc.text('Firma del Committente', MARGINE + 295, sY + 46, { width: 250, align: 'center' });
  doc.y = sY + 80;

  if (contratto.stato === 'firmato' && contratto.firmaImg) {
    bloccoFirma(doc, contratto.nome || nomeCompleto, luogo, data, contratto.firmaImg);
  }
  footer(doc);
  return docToBuffer(doc);
}

export async function generaContrattoPazientePDF(contratto: any, paziente: any): Promise<Buffer> {
  if (contratto.profilo === 'Assistente familiare') return pdfMandatoBadante(contratto, paziente);
  return pdfContrattoGenerico(contratto, paziente);
}

// ─── PDF informativa GDPR + consenso ──────────────────────────────────────────
export async function generaGdprPDF(paziente: any, opts: {
  nomeFirmatario?: string;
  cognomeFirmatario?: string;
  dataFirma?: Date;
  luogoFirma?: string;
  finalita?: any;
  datiSensibili?: any;
  accettato?: boolean;
  firmaImg?: string;
} = {}): Promise<Buffer> {
  const doc = nuovoDoc();
  const dataFmt = fmtData(opts.dataFirma || new Date());
  const nascitaFmt = paziente.birthDate ? fmtData(paziente.birthDate) : '_______________';
  const luogo = opts.luogoFirma || 'Roma';
  const nomeCompleto = `${opts.nomeFirmatario || ''} ${opts.cognomeFirmatario || ''}`.trim() || `${paziente.firstName} ${paziente.lastName}`;
  const finalita = opts.finalita || { prestazioneSanitaria: true, fatturazione: true, auditInterno: true };
  const datiSensibili = opts.datiSensibili || { datiSanitari: true, datiEconomici: true, immagini: false };

  // Header centrato
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor(BLU)
    .text('INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI', MARGINE, MARGINE, { width: LARGHEZZA, align: 'center' });
  doc.text("E DI CATEGORIA PARTICOLARE PER L'EROGAZIONE DEI SERVIZI", { width: LARGHEZZA, align: 'center' });
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(8.5).fillColor(GRIGIO)
    .text('Ai sensi del Regolamento UE 2016/679 (GDPR) e del D.Lgs. 196/2003 — Versione v2026.1', { width: LARGHEZZA, align: 'center' });
  doc.moveTo(MARGINE, doc.y + 6).lineTo(MARGINE + LARGHEZZA, doc.y + 6).strokeColor(BLU).lineWidth(1.5).stroke();
  doc.moveDown(1.2);

  // Box paziente
  const bY = doc.y;
  doc.rect(MARGINE, bY, LARGHEZZA, 34).fillAndStroke('#f0f4ff', '#c7d7f0');
  doc.font('Helvetica').fontSize(9).fillColor('#111111')
    .text(`Paziente: ${paziente.firstName} ${paziente.lastName}   |   Nato/a il: ${nascitaFmt}`, MARGINE + 10, bY + 7, { width: LARGHEZZA - 20 });
  doc.text(`Data firma: ${dataFmt}   |   Firmatario: ${nomeCompleto}`, MARGINE + 10, bY + 20, { width: LARGHEZZA - 20 });
  doc.y = bY + 44;

  testo(doc, `Gent. Sig.ra / Egr. Sig. ${paziente.firstName} ${paziente.lastName}, con la presente desideriamo comunicarLe che per l'instaurazione e la gestione del Servizio di assistenza domiciliare integrata, la nostra Società, Abbraccio Cure Domiciliari, con sede legale in Roma, Via Di Santa Maria Ausiliatrice 4b, tratterà i Suoi Dati Personali in qualità di Responsabile del trattamento, ai sensi del Regolamento (UE) 2016/679 (GDPR).`);

  sezione(doc, '1. OGGETTO DEL TRATTAMENTO');
  testo(doc, 'Al fine di poterLe fornire i Servizi, la Società tratterà i seguenti dati:', { gap: 0.15 });
  bullet(doc, 'Dati comuni identificativi: nome, cognome, indirizzo, telefono, e-mail, residenza, ecc.');
  bullet(doc, 'Categorie particolari di dati (art. 9 GDPR): dati idonei a rivelare lo stato di salute (documentazione sanitaria, cartelle cliniche).');

  sezione(doc, '2. BASE GIURIDICA E FINALITÀ DEL TRATTAMENTO');
  testo(doc, 'I Dati saranno trattati, senza necessità di consenso, ai sensi di: art. 6 c.1 lett. b) e c) GDPR; art. 9 c.2 lett. b), h) e j) GDPR. Le finalità sono:', { gap: 0.15 });
  bullet(doc, 'Puntuale adempimento del Servizio affidatoci;');
  bullet(doc, 'Adempimento di obblighi di legge connessi al Servizio;');
  bullet(doc, 'Gestione del contenzioso ed esercizio dei diritti in sede giudiziaria;');
  bullet(doc, 'Collaborazione con pubbliche autorità, prevenzione di atti illeciti.');
  const hY = doc.y + 4;
  doc.rect(MARGINE, hY, LARGHEZZA, 22).fill('#fef3c7');
  doc.rect(MARGINE, hY, 3, 22).fill('#f59e0b');
  doc.font('Helvetica').fontSize(8.5).fillColor('#78350f')
    .text('Per finalità diverse sarà richiesto un Suo esplicito ulteriore consenso.', MARGINE + 10, hY + 6, { width: LARGHEZZA - 20 });
  doc.y = hY + 30;

  sezione(doc, '3. MODALITÀ DEL TRATTAMENTO');
  testo(doc, 'Il trattamento potrà avvenire mediante supporto cartaceo, informatico o telefonico, nel rispetto dei principi di liceità, correttezza e trasparenza, con misure adeguate di sicurezza (pseudonimizzazione, crittografia, controllo accessi).');

  sezione(doc, '4. COMUNICAZIONE DEI DATI');
  testo(doc, 'I dati potranno essere comunicati a: enti pubblici (ASL, Ospedali, INAIL, INPS ecc.); farmacie, medici specialisti, professionisti sanitari; società di manutenzione tecnica; aziende di credito/assicurazione; consulenti legali, fiscali, amministrativi.');

  sezione(doc, '5. CONSERVAZIONE');
  testo(doc, "I dati saranno conservati non oltre 10 anni dalla cessazione del Servizio, ai sensi degli obblighi di legge vigenti. A fini statistici e storici, ai sensi dell'art. 89 par. 1 GDPR, con adeguate misure di pseudonimizzazione.");

  sezione(doc, '6. I SUOI DIRITTI (ARTT. 15–21 GDPR)');
  const diritti = [
    'Accesso (art. 15): ottenere conferma e copia dei dati trattati;',
    'Rettifica (art. 16): correggere dati inesatti o incompleti;',
    'Cancellazione / Oblio (art. 17): richiedere cancellazione o anonimizzazione;',
    'Limitazione (art. 18): limitare il trattamento nei casi previsti;',
    'Portabilità (art. 20): ricevere i dati in formato strutturato e leggibile;',
    'Opposizione (art. 21): opporsi al trattamento per motivi legittimi;',
    'Revoca del consenso: in qualsiasi momento, senza pregiudizio per il trattamento pregresso.',
  ];
  for (const d of diritti) bullet(doc, d);

  sezione(doc, '7. CONTATTI PER ESERCITARE I DIRITTI E RECLAMO AL GARANTE');
  bullet(doc, 'Abbraccio Cure Domiciliari: abbracciocuredomiciliari@gmail.com — Tel. 351 417 5117');
  bullet(doc, 'Garante Privacy: Piazza di Monte Citorio 121, 00186 Roma — garante@gpdp.it — Fax 06-696773785');
  bullet(doc, 'Sito web: www.garanteprivacy.it');

  // Box consenso
  if (doc.y > 640) doc.addPage();
  const cY = doc.y + 8;
  const acc = finalita.prestazioneSanitaria ? 'X' : ' ';
  const nonAcc = finalita.prestazioneSanitaria ? ' ' : 'X';
  const boxLines = [
    `Preso atto dell'informativa sopra indicata:`,
    `Acconsento al trattamento dei miei Dati Personali per le finalità di cui al paragrafo 2 dell'informativa, connesse alla corretta esecuzione del/i Servizio/i richiesto/i.`,
    `[${acc}] Acconsento    [${nonAcc}] Non acconsento`,
    `Finalità accettate: Prestazione sanitaria ${finalita.prestazioneSanitaria ? '✓' : '✗'}, Fatturazione ${finalita.fatturazione ? '✓' : '✗'}, Audit interno ${finalita.auditInterno ? '✓' : '✗'}.`,
    `Dati sensibili: Sanitari ${datiSensibili.datiSanitari ? '✓' : '✗'}, Economici ${datiSensibili.datiEconomici ? '✓' : '✗'}, Immagini ${datiSensibili.immagini ? '✓' : '✗'}.`,
  ];
  doc.font('Helvetica').fontSize(9);
  const hBox = boxLines.reduce((h, l) => h + doc.heightOfString(l, { width: LARGHEZZA - 30 }) + 6, 0) + 60;
  doc.rect(MARGINE, cY, LARGHEZZA, hBox).fillAndStroke('#fafbff', BLU);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(BLU)
    .text('CONSENSO AL TRATTAMENTO DEI DATI PERSONALI', MARGINE + 15, cY + 12, { width: LARGHEZZA - 30 });
  let ly = cY + 32;
  for (const [i, l] of boxLines.entries()) {
    doc.font(i === 2 ? 'Helvetica-Bold' : 'Helvetica').fontSize(i >= 3 ? 8 : 9).fillColor('#111111')
      .text(l, MARGINE + 15, ly, { width: LARGHEZZA - 30, lineGap: 1.5 });
    ly += doc.heightOfString(l, { width: LARGHEZZA - 30 }) + 6;
  }
  if (opts.accettato) {
    doc.font('Helvetica').fontSize(8.5).fillColor(VERDE)
      .text("✓ Consenso prestato elettronicamente in seguito a lettura dell'informativa, contestualmente alla firma del contratto d'incarico.", MARGINE + 15, ly, { width: LARGHEZZA - 30 });
  }
  doc.y = cY + hBox + 14;

  // Firma
  if (doc.y > 720) doc.addPage();
  const fY = doc.y;
  doc.font('Helvetica').fontSize(8.5).fillColor('#555555')
    .text(`Firma: ${nomeCompleto} — ${luogo}, ${dataFmt}`, MARGINE, fY, { width: LARGHEZZA });
  if (opts.firmaImg && opts.firmaImg.startsWith('data:image')) {
    try {
      doc.image(Buffer.from(opts.firmaImg.split(',')[1], 'base64'), MARGINE, fY + 12, { width: 170 });
      doc.y = fY + 80;
    } catch { doc.y = fY + 40; }
  } else {
    doc.moveTo(MARGINE, fY + 36).lineTo(MARGINE + 280, fY + 36).strokeColor('#333333').lineWidth(0.8).stroke();
    doc.y = fY + 50;
  }

  footer(doc);
  return docToBuffer(doc);
}
