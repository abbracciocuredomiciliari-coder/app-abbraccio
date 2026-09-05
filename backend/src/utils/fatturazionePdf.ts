import PDFDocument from 'pdfkit';
import { decrypt } from './encryption';

const AZIENDA = {
  nome: process.env.AZIENDA_NOME || 'ABBRACCIO CURE DOMICILIARI S.R.L.S.',
  indirizzo: process.env.AZIENDA_INDIRIZZO || 'ROMA (RM) VIA DI S MARIA AUSILIATRICE 4B',
  capCitta: process.env.AZIENDA_CAP_CITTA || 'CAP 00181',
  pec: process.env.AZIENDA_PEC || 'abbracciocuredomiciliari@facilepec.com',
  rea: process.env.AZIENDA_REA || 'RM - 1777027',
  cf: process.env.AZIENDA_CF || '18316251000',
  piva: process.env.AZIENDA_PIVA || 'P.IVA da configurare',
  formaGiuridica: process.env.AZIENDA_FORMA_GIURIDICA || "societa' a responsabilita' limitata semplificata",
  amministratore: process.env.AZIENDA_AMMINISTRATORE || 'SCHEMBRI SIMONA',
};

function formatEuro(n: number) {
  return `€ ${(Number(n) || 0).toFixed(2).replace('.', ',')}`;
}

function formatData(d: any) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('it-IT');
  } catch {
    return String(d);
  }
}

export function generaDocumentoPDF(doc: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const pdf = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      pdf.on('data', (chunk) => chunks.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));

      // ─── Intestazione azienda (sinistra)
      pdf.font('Helvetica-Bold').fontSize(18).fillColor('#1e4d8c');
      const titleH = pdf.heightOfString(AZIENDA.nome, { width: 260 });
      pdf.text(AZIENDA.nome, 50, 50, { width: 260 });

      pdf.font('Helvetica').fontSize(9).fillColor('#333333');
      const dettagliAzienda = [
        AZIENDA.indirizzo,
        AZIENDA.capCitta,
        `PEC: ${AZIENDA.pec}`,
        `REA: ${AZIENDA.rea}`,
        `C.F. / P.IVA: ${AZIENDA.cf} / ${AZIENDA.piva}`,
        `Forma giuridica: ${AZIENDA.formaGiuridica}`,
        `Amministratrice Unica: ${AZIENDA.amministratore}`,
      ];
      let y = 50 + titleH + 10;
      for (const linea of dettagliAzienda) {
        const h = pdf.heightOfString(linea, { width: 260, lineGap: 1 });
        pdf.text(linea, 50, y, { width: 260, lineGap: 1 });
        y += h + 4;
      }

      // ─── Tipo documento (destra)
      const tipoLabel = doc.tipo === 'fattura' ? 'FATTURA' : 'PREVENTIVO';
      pdf.font('Helvetica-Bold').fontSize(26).fillColor('#1e4d8c').text(tipoLabel, 340, 50, { width: 210, align: 'right' });
      pdf.font('Helvetica').fontSize(10).fillColor('#333333');
      pdf.text(`n. ${doc.numero || '-'}`, 340, 82, { width: 210, align: 'right' });
      pdf.text(`Data: ${formatData(doc.data)}`, 340, 97, { width: 210, align: 'right' });
      if (doc.dataPrestazione) {
        pdf.text(`Data prestazione: ${formatData(doc.dataPrestazione)}`, 340, 112, { width: 210, align: 'right' });
      }

      // ─── Box dati cliente
      const rawPatient = doc.patient || {};
      const patient = rawPatient.toJSON ? rawPatient.toJSON() : { ...rawPatient };
      patient.address = decrypt(patient.address);
      patient.codiceFiscale = decrypt(patient.codiceFiscale);
      patient.contactPhone = decrypt(patient.contactPhone);
      patient.email = decrypt(patient.email);
      const nomePaziente = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Nominativo non disponibile';
      const cf = patient.codiceFiscale || '—';
      const address = patient.address || '—';

      const boxWidth = 300;
      const labelHeight = 18;
      pdf.font('Helvetica').fontSize(9).fillColor('#000000');
      const nameH = Math.max(14, pdf.heightOfString(`Nome: ${nomePaziente}`, { width: boxWidth - 20 }));
      const addrH = Math.max(14, pdf.heightOfString(`Indirizzo: ${address}`, { width: boxWidth - 20 }));
      const cfH = Math.max(14, pdf.heightOfString(`Codice Fiscale: ${cf}`, { width: boxWidth - 20 }));
      const boxHeight = labelHeight + 10 + nameH + addrH + cfH + 16;

      const boxY = y + 25;
      pdf.rect(50, boxY, boxWidth, boxHeight).fillAndStroke('#f8fafc', '#1e4d8c');
      pdf.font('Helvetica-Bold').fontSize(11).fillColor('#1e4d8c').text('DATI CLIENTE', 60, boxY + 8);
      pdf.font('Helvetica').fontSize(9).fillColor('#000000');
      let py = boxY + 28;
      pdf.text(`Nome: ${nomePaziente}`, 60, py, { width: boxWidth - 20, lineGap: 1 });
      py += nameH + 4;
      pdf.text(`Indirizzo: ${address}`, 60, py, { width: boxWidth - 20, lineGap: 1 });
      py += addrH + 4;
      pdf.text(`Codice Fiscale: ${cf}`, 60, py, { width: boxWidth - 20 });

      // ─── Tabella prestazioni
      const startY = boxY + boxHeight + 30;
      const colX = [50, 310, 360, 460];
      const colW = [260, 50, 100, 100];
      const rowH = 22;

      pdf.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
      pdf.rect(colX[0], startY, colW[0], rowH).fillAndStroke('#1e4d8c', '#1e4d8c');
      pdf.rect(colX[1], startY, colW[1], rowH).fillAndStroke('#1e4d8c', '#1e4d8c');
      pdf.rect(colX[2], startY, colW[2], rowH).fillAndStroke('#1e4d8c', '#1e4d8c');
      pdf.rect(colX[3], startY, colW[3], rowH).fillAndStroke('#1e4d8c', '#1e4d8c');

      pdf.fillColor('#ffffff');
      pdf.text('Prestazione', colX[0] + 5, startY + 6, { width: colW[0] - 10 });
      pdf.fillColor('#ffffff');
      pdf.text('Qtà', colX[1] + 5, startY + 6, { width: colW[1] - 10, align: 'center' });
      pdf.fillColor('#ffffff');
      pdf.text('Prezzo un.', colX[2] + 5, startY + 6, { width: colW[2] - 10, align: 'right' });
      pdf.fillColor('#ffffff');
      pdf.text('Importo', colX[3] + 5, startY + 6, { width: colW[3] - 10, align: 'right' });

      let rowY = startY + rowH;
      pdf.font('Helvetica').fontSize(9).fillColor('#000000');
      const prestazioni = Array.isArray(doc.prestazioni) ? doc.prestazioni : [];
      for (const p of prestazioni) {
        const desc = String(p.descrizione || '').trim() || 'Prestazione';
        const qty = Number(p.quantita) || 1;
        const unit = Number(p.prezzoUnitario) || 0;
        const importo = Number(p.importo) || 0;

        const descH = pdf.heightOfString(desc, { width: colW[0] - 10 });
        const h = Math.max(20, descH + 10);

        // Check new page
        if (rowY + h > 740) {
          pdf.addPage();
          rowY = 50;
          pdf.font('Helvetica').fontSize(9).fillColor('#000000');
        }

        pdf.rect(colX[0], rowY, colW[0], h).fillAndStroke('#ffffff', '#e2e8f0');
        pdf.rect(colX[1], rowY, colW[1], h).fillAndStroke('#ffffff', '#e2e8f0');
        pdf.rect(colX[2], rowY, colW[2], h).fillAndStroke('#ffffff', '#e2e8f0');
        pdf.rect(colX[3], rowY, colW[3], h).fillAndStroke('#ffffff', '#e2e8f0');

        pdf.fillColor('#000000').font('Helvetica').fontSize(9);
        pdf.text(desc, colX[0] + 5, rowY + 5, { width: colW[0] - 10, lineGap: 1 });
        pdf.fillColor('#000000');
        pdf.text(String(qty), colX[1] + 5, rowY + 5, { width: colW[1] - 10, align: 'center' });
        pdf.fillColor('#000000');
        pdf.text(formatEuro(unit), colX[2] + 5, rowY + 5, { width: colW[2] - 10, align: 'right' });
        pdf.fillColor('#000000');
        pdf.text(formatEuro(importo), colX[3] + 5, rowY + 5, { width: colW[3] - 10, align: 'right' });

        rowY += h;
      }

      // ─── Totale
      let totalY = rowY + 25;
      if (totalY > 740) {
        pdf.addPage();
        totalY = 50;
      }
      pdf.rect(360, totalY, 200, 45).fillAndStroke('#f0fdf4', '#16a34a');
      pdf.font('Helvetica-Bold').fontSize(10).fillColor('#166534').text('TOTALE', 370, totalY + 8, { width: 90, align: 'left' });
      pdf.font('Helvetica-Bold').fontSize(18).fillColor('#166534').text(formatEuro(Number(doc.totale) || 0), 370, totalY + 22, { width: 180, align: 'right' });

      // ─── Note e scadenze
      let noteY = totalY + 65;
      if (noteY > 700) {
        pdf.addPage();
        noteY = 50;
      }

      if (doc.tipo === 'fattura') {
        pdf.font('Helvetica-Oblique').fontSize(9).fillColor('#555555').text('Operazione effettuata ai sensi del DPR 633/72. Per servizi sanitari di tipo domiciliare si applica l\'esenzione IVA ove previsto dalla normativa vigente.', 50, noteY, { width: 500 });
        noteY += 28;
      }

      if (doc.note) {
        pdf.font('Helvetica-Bold').fontSize(9).fillColor('#333333').text('Note:', 50, noteY);
        const noteH = pdf.heightOfString(String(doc.note), { width: 500 });
        if (noteY + noteH + 20 > 760) {
          pdf.addPage();
          noteY = 50;
        }
        pdf.font('Helvetica').fontSize(9).fillColor('#333333').text(String(doc.note), 50, noteY + 13, { width: 500, lineGap: 1 });
        noteY += noteH + 25;
      }

      // ─── Firma / Rifiuto Sistema TS
      let signatureY = noteY + 40;
      if (signatureY > 650) {
        pdf.addPage();
        signatureY = 50;
      }

      if (doc.firma?.firmato) {
        pdf.rect(50, signatureY, 500, 120).fillAndStroke('#f0fdf4', '#16a34a');
        pdf.font('Helvetica-Bold').fontSize(11).fillColor('#166534').text('DOCUMENTO FIRMATO DIGITALMENTE', 60, signatureY + 10);
        pdf.font('Helvetica').fontSize(9).fillColor('#000000');
        let sy = signatureY + 30;
        const nomeFirmatario = doc.firma.nome || 'Sottoscrittore';
        pdf.text(`Firmato da: ${nomeFirmatario} il ${formatData(doc.firma.firmatoIl)}`, 60, sy);
        sy += 16;
        if (doc.tipo === 'fattura') {
          if (doc.firma.rifiutoRegistro) {
            pdf.text('Il paziente/caregiver ha esplicitamente RIFIUTATO la comunicazione dei dati al Sistema TS (spese sanitarie).', 60, sy);
          } else {
            pdf.text('Il paziente/caregiver ha ACCONSENTITO alla comunicazione dei dati al Sistema TS (spese sanitarie).', 60, sy);
          }
          sy += 20;
        } else {
          sy += 4;
        }
        if (doc.firma.firmaImg) {
          const base64Data = String(doc.firma.firmaImg).replace(/^data:image\/\w+;base64,/, '');
          try {
            const imgBuffer = Buffer.from(base64Data, 'base64');
            pdf.image(imgBuffer, 60, sy, { width: 180 });
          } catch (imgErr) {
            console.warn('Errore inserimento firma nel PDF:', (imgErr as Error).message);
          }
        }
      } else {
        pdf.rect(50, signatureY, 500, 110).fillAndStroke('#ffffff', '#e2e8f0');
        pdf.font('Helvetica-Bold').fontSize(10).fillColor('#1e4d8c').text('FIRMA PER ACCETTAZIONE / RIFIUTO COMUNICAZIONE SISTEMA TS', 60, signatureY + 10);
        pdf.font('Helvetica').fontSize(9).fillColor('#000000');
        pdf.text('Il paziente/caregiver, preso atto del documento, dichiara:', 60, signatureY + 28);
        pdf.text('☐ ACCONSENTE alla comunicazione dei dati al Sistema TS (spese sanitarie)', 60, signatureY + 46);
        pdf.text('☐ RIFIUTA la comunicazione dei dati al Sistema TS (spese sanitarie)', 60, signatureY + 62);
        pdf.text('Firma: ____________________________________________    Data: _______________', 60, signatureY + 88);
      }

      // ─── Footer
      pdf.font('Helvetica').fontSize(8).fillColor('#888888').text('Documento generato elettronicamente da Abbraccio Cure Domiciliari S.R.L.S.', 50, 790, { width: 500, align: 'center' });

      pdf.end();
    } catch (err) {
      reject(err);
    }
  });
}

export default generaDocumentoPDF;
