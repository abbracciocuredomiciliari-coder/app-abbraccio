import PDFDocument from 'pdfkit';
import { AZIENDA } from './contrattoPazientePdf';

const BLU = '#1e4d8c';
const VERDE = '#166534';
const GRIGIO = '#555555';
const MARGINE = 42;
const LARGHEZZA = 595 - 2 * MARGINE;

const LABEL_ESAME: Record<string, string> = {
  rx_domiciliare: 'RX domiciliare',
  ecografia_domiciliare: 'Ecografia domiciliare',
  ecocolordoppler: 'EcoColorDoppler',
  ecocolordoppler_tsa: 'EcoColorDoppler TSA',
  altro: 'Altro esame',
};

const LABEL_PRESCRIZIONE: Record<string, string> = {
  allegata: 'Allegata',
  da_consegnare: 'Da consegnare al professionista',
  non_prevista: 'Non prevista per la prestazione concordata',
};

const LABEL_ACCESSO: Record<string, string> = {
  allettato: 'Allettato',
  deambulante: 'Deambulante',
  carrozzina: 'Carrozzina',
  ascensore: 'Ascensore',
  scaleAccessoDifficoltoso: 'Scale/accesso difficoltoso',
  ossigenoterapia: 'Ossigenoterapia',
};

function fmtData(d: any) {
  if (!d) return '_______________';
  try { return new Date(d).toLocaleDateString('it-IT'); } catch { return String(d); }
}

function fmtEuro(n: number) {
  return `€ ${Number(n || 0).toFixed(2).replace('.', ',')}`;
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

function sezione(doc: InstanceType<typeof PDFDocument>, titolo: string) {
  if (doc.y > 740) doc.addPage();
  const y = doc.y + 6;
  doc.rect(MARGINE, y, LARGHEZZA, 18).fill('#eef3f7');
  doc.rect(MARGINE, y, 4, 18).fill(BLU);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(BLU).text(titolo, MARGINE + 10, y + 4, { width: LARGHEZZA - 20 });
  doc.y = y + 24;
}

function campo(doc: InstanceType<typeof PDFDocument>, label: string, valore: string, larghezzaLabel = 150) {
  if (doc.y > 755) doc.addPage();
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#475569').text(label.toUpperCase(), MARGINE, y, { width: larghezzaLabel });
  doc.font('Helvetica').fontSize(9.5).fillColor('#111111').text(valore || '_______________', MARGINE + larghezzaLabel + 5, y - 1, { width: LARGHEZZA - larghezzaLabel - 5 });
  doc.moveTo(MARGINE, doc.y + 2).lineTo(MARGINE + LARGHEZZA, doc.y + 2).strokeColor('#cbd5e1').lineWidth(0.6).stroke();
  doc.moveDown(0.4);
}

function campoDoppio(doc: InstanceType<typeof PDFDocument>, l1: string, v1: string, l2: string, v2: string) {
  if (doc.y > 755) doc.addPage();
  const y = doc.y;
  const metà = LARGHEZZA / 2;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#475569').text(l1.toUpperCase(), MARGINE, y, { width: 90 });
  doc.font('Helvetica').fontSize(9.5).fillColor('#111111').text(v1 || '___', MARGINE + 95, y - 1, { width: metà - 95 });
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#475569').text(l2.toUpperCase(), MARGINE + metà, y, { width: 90 });
  doc.font('Helvetica').fontSize(9.5).fillColor('#111111').text(v2 || '___', MARGINE + metà + 95, y - 1, { width: metà - 95 });
  doc.moveTo(MARGINE, doc.y + 2).lineTo(MARGINE + LARGHEZZA, doc.y + 2).strokeColor('#cbd5e1').lineWidth(0.6).stroke();
  doc.moveDown(0.4);
}

function checkbox(doc: InstanceType<typeof PDFDocument>, x: number, y: number, checked: boolean) {
  doc.rect(x, y, 9, 9).lineWidth(0.8).strokeColor('#333333').stroke();
  if (checked) {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(VERDE).text('X', x + 1.3, y - 0.5);
  }
}

function headerAzienda(doc: InstanceType<typeof PDFDocument>) {
  doc.rect(0, 0, 595, 70).fill(BLU);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#ffffff').text('COLLABORAZIONE DIAGNOSTICA DOMICILIARE', MARGINE, 12, { width: LARGHEZZA, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#dbeafe').text('ABBRACCIO CURE DOMICILIARI × RX TEAM', MARGINE, 30, { width: LARGHEZZA, align: 'center' });
  doc.font('Helvetica').fontSize(8.5).fillColor('#ffffff').text('FOGLIO DI ACCOMPAGNAMENTO / PRENOTAZIONE — Prestazione diagnostica domiciliare', MARGINE, 46, { width: LARGHEZZA, align: 'center' });
  doc.y = 82;
}

function footer(doc: InstanceType<typeof PDFDocument>) {
  const y = 800;
  doc.moveTo(MARGINE, y).lineTo(MARGINE + LARGHEZZA, y).strokeColor('#cbd5e1').lineWidth(0.6).stroke();
  doc.font('Helvetica').fontSize(7).fillColor(GRIGIO)
    .text('ABBRACCIO CURE DOMICILIARI • Via Santa Maria Ausiliatrice 4B, Roma • Tel. 06 01905 242 • WhatsApp 351 4175117 — Documento organizzativo: non sostituisce la prescrizione medica quando richiesta.', MARGINE, y + 6, { width: LARGHEZZA, align: 'center' });
}

export async function generaMandatoRxTeamPDF(mandato: any, paziente: any): Promise<Buffer> {
  const doc = nuovoDoc();
  headerAzienda(doc);

  // N. pratica / data / operatore
  const y0 = doc.y;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#475569').text('N. PRATICA', MARGINE, y0, { width: 120 });
  doc.font('Helvetica').fontSize(9.5).fillColor('#111111').text(mandato.nPratica || '___', MARGINE + 60, y0 - 1, { width: 110 });
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#475569').text('DATA RICHIESTA', MARGINE + 180, y0, { width: 90 });
  doc.font('Helvetica').fontSize(9.5).fillColor('#111111').text(fmtData(mandato.dataRichiesta), MARGINE + 250, y0 - 1, { width: 90 });
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#475569').text('OPERATORE ABBRACCIO', MARGINE + 350, y0, { width: 100 });
  doc.font('Helvetica').fontSize(9.5).fillColor('#111111').text(mandato.operatoreAbbraccio || '___', MARGINE + 350, y0 + 10, { width: 145 });
  doc.y = y0 + 28;
  doc.moveTo(MARGINE, doc.y).lineTo(MARGINE + LARGHEZZA, doc.y).strokeColor('#cbd5e1').lineWidth(0.6).stroke();
  doc.moveDown(0.5);

  sezione(doc, 'DATI DEL PAZIENTE');
  campo(doc, 'Nome e cognome', `${paziente.firstName || ''} ${paziente.lastName || ''}`.trim());
  campo(doc, 'Data di nascita', fmtData(paziente.birthDate));
  campo(doc, 'Telefono paziente / familiare', paziente.contactPhone || '');
  campo(doc, 'Indirizzo domicilio esame', paziente.address || '');

  sezione(doc, 'ESAME RICHIESTO');
  const esami: { tipo: string; dettaglio?: string }[] = mandato.esami || [];
  const tipiPresenti = new Set(esami.map((e) => e.tipo));
  const ordineEsami = ['rx_domiciliare', 'ecografia_domiciliare', 'ecocolordoppler', 'ecocolordoppler_tsa', 'altro'];
  for (const tipo of ordineEsami) {
    const presente = tipiPresenti.has(tipo);
    const e = esami.find((x) => x.tipo === tipo);
    if (doc.y > 755) doc.addPage();
    const y = doc.y;
    checkbox(doc, MARGINE, y + 1, presente);
    doc.font(presente ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(presente ? '#111111' : '#6b7280')
      .text(LABEL_ESAME[tipo], MARGINE + 14, y, { width: 150 });
    if (tipo !== 'rx_domiciliare' || true) {
      doc.font('Helvetica').fontSize(8.5).fillColor('#475569').text('Distretto / tipo:', MARGINE + 170, y, { width: 80 });
      doc.font('Helvetica').fontSize(9).fillColor('#111111').text(e?.dettaglio || '________________', MARGINE + 250, y, { width: LARGHEZZA - 250 });
    }
    doc.y = y + 16;
  }
  doc.moveDown(0.3);
  campo(doc, 'Prescrizione medica', LABEL_PRESCRIZIONE[mandato.prescrizioneMedica] || '');
  campo(doc, 'Quesito clinico / indicazioni', mandato.quesitoClinico || '');

  sezione(doc, "COMPENSO E ACCETTAZIONE DELL'ESAME");
  const compensoY = doc.y;
  const compensoTxt = `Compenso pattuito per la prestazione richiesta: ${fmtEuro(mandato.compenso)}`;
  doc.rect(MARGINE, compensoY, LARGHEZZA, 26).fill('#f0fdf4');
  doc.rect(MARGINE, compensoY, 4, 26).fill('#16a34a');
  doc.font('Helvetica-Bold').fontSize(11).fillColor(VERDE).text(compensoTxt, MARGINE + 12, compensoY + 7, { width: LARGHEZZA - 24 });
  doc.y = compensoY + 34;
  doc.font('Helvetica').fontSize(8.5).fillColor(GRIGIO)
    .text('Il compenso sopra indicato viene corrisposto direttamente a RX Team all\'atto dell\'esecuzione dell\'esame. Il presente foglio identifica la prestazione come proveniente da Abbraccio Cure Domiciliari ai fini del riepilogo mensile tra le parti ed ha valore di accettazione della prestazione e del relativo compenso da parte del paziente/familiare.', MARGINE, doc.y, { width: LARGHEZZA, lineGap: 1.5 });
  doc.moveDown(0.6);

  sezione(doc, 'APPUNTAMENTO CONCORDATO CON RX TEAM');
  campoDoppio(doc, 'Data esecuzione', mandato.dataEsecuzione || '', 'Fascia oraria', mandato.fasciaOraria || '');
  campoDoppio(doc, 'Referente RX Team', mandato.referenteRxTeam || '', 'Recapito / note', mandato.recapitoNote || '');

  sezione(doc, "INFORMAZIONI UTILI PER L'ACCESSO DOMICILIARE");
  const accesso = mandato.accessoInfo || {};
  const chiaviAccesso = Object.keys(LABEL_ACCESSO);
  let ax = MARGINE;
  let ay = doc.y;
  const colWidth = LARGHEZZA / 3;
  chiaviAccesso.forEach((chiave, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = MARGINE + col * colWidth;
    const y = ay + row * 18;
    checkbox(doc, x, y + 1, !!accesso[chiave]);
    doc.font('Helvetica').fontSize(8.5).fillColor('#111111').text(LABEL_ACCESSO[chiave], x + 14, y, { width: colWidth - 16 });
  });
  doc.y = ay + Math.ceil(chiaviAccesso.length / 3) * 18 + 6;
  campo(doc, 'Note organizzative', mandato.noteOrganizzative || '');

  // Blocco firma / accettazione
  if (doc.y > 680) doc.addPage();
  sezione(doc, 'ACCETTAZIONE DEL PAZIENTE / FAMILIARE');
  const luogo = mandato.luogoFirma || 'Roma';
  const dataFirma = mandato.dataFirma ? new Date(mandato.dataFirma).toLocaleDateString('it-IT') : fmtData(new Date());
  const nomeFirmatario = mandato.nome || `${paziente.firstName || ''} ${paziente.lastName || ''}`.trim();
  if (mandato.stato === 'firmato') {
    testoAccettato(doc, `Accettato da ${nomeFirmatario} — ${luogo}, ${dataFirma}`);
    if (mandato.firmaImg && String(mandato.firmaImg).startsWith('data:image')) {
      try {
        const base64 = String(mandato.firmaImg).split(',')[1];
        const img = Buffer.from(base64, 'base64');
        if (doc.y > 700) doc.addPage();
        doc.image(img, MARGINE, doc.y + 4, { width: 170 });
        doc.y += 60;
      } catch { /* firma non renderizzabile */ }
    }
  } else {
    doc.font('Helvetica').fontSize(8.5).fillColor(GRIGIO)
      .text('Dichiaro di aver letto il presente foglio di accompagnamento, di aver compreso l\'esame richiesto e il relativo compenso, e di accettare la prestazione concordata con RX Team.', MARGINE, doc.y, { width: LARGHEZZA, lineGap: 1.5 });
    doc.moveDown(1);
    const sY = doc.y;
    doc.moveTo(MARGINE, sY + 30).lineTo(MARGINE + 260, sY + 30).strokeColor('#94a3b8').lineWidth(0.8).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(GRIGIO).text('Firma del paziente / familiare', MARGINE, sY + 34, { width: 260 });
    doc.y = sY + 54;
  }

  doc.moveDown(0.6);
  doc.font('Helvetica').fontSize(8).fillColor(GRIGIO).text('ABBRACCIO CURE DOMICILIARI — Firma / timbro: ______________________________', MARGINE, doc.y);
  doc.moveDown(0.3);
  doc.text('RX TEAM — Presa in carico / esecuzione — Data ____________   Firma / sigla __________________', MARGINE, doc.y);

  footer(doc);
  return docToBuffer(doc);
}

function testoAccettato(doc: InstanceType<typeof PDFDocument>, t: string) {
  const y = doc.y;
  doc.rect(42, y, LARGHEZZA, 20).fill('#dcfce7');
  doc.font('Helvetica-Bold').fontSize(9).fillColor(VERDE).text(`✅ ${t}`, 50, y + 5, { width: LARGHEZZA - 16 });
  doc.y = y + 28;
}
