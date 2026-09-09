import PDFDocument from 'pdfkit';

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

export function generaRitenutaPDF(ritenuta: any, isFirmato = false): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const pdf = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      pdf.on('data', (chunk) => chunks.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));

      // Intestazione azienda (sinistra)
      pdf.font('Helvetica-Bold').fontSize(16).fillColor('#1e4d8c');
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
      let y = 50 + titleH + 8;
      for (const linea of dettagliAzienda) {
        const h = pdf.heightOfString(linea, { width: 260, lineGap: 1 });
        pdf.text(linea, 50, y, { width: 260, lineGap: 1 });
        y += h + 3;
      }

      // Tipo documento (destra)
      pdf.font('Helvetica-Bold').fontSize(20).fillColor('#1e4d8c').text("RITENUTA D'ACCONTO", 340, 50, { width: 210, align: 'right' });
      pdf.font('Helvetica-Bold').fontSize(10).fillColor('#333333');
      pdf.text(`Numero ritenuta: ${ritenuta.numero || '-'}`, 340, 76, { width: 210, align: 'right' });
      pdf.font('Helvetica').fontSize(10).fillColor('#333333');
      pdf.text(`Data ritenuta: ${formatData(ritenuta.data)}`, 340, 92, { width: 210, align: 'right' });

      // Box professionista
      const prof = ritenuta.datiProfessionista || {};
      const nomeProf = `${prof.firstName || ''} ${prof.lastName || ''}`.trim() || 'Nominativo non disponibile';
      const cf = prof.codiceFiscale || '—';
      const piva = prof.partitaIva || '—';
      const indirizzo = [prof.indirizzo, prof.citta].filter(Boolean).join(' - ') || '—';

      const boxWidth = 300;
      const labelHeight = 18;
      pdf.font('Helvetica').fontSize(9).fillColor('#000000');
      const nameH = Math.max(14, pdf.heightOfString(`Nominativo: ${nomeProf}`, { width: boxWidth - 20 }));
      const cfH = Math.max(14, pdf.heightOfString(`Codice Fiscale: ${cf}`, { width: boxWidth - 20 }));
      const pivaH = Math.max(14, pdf.heightOfString(`P. IVA: ${piva}`, { width: boxWidth - 20 }));
      const indH = Math.max(14, pdf.heightOfString(`Indirizzo: ${indirizzo}`, { width: boxWidth - 20 }));
      const boxHeight = labelHeight + 10 + nameH + cfH + pivaH + indH + 20;

      const boxY = y + 25;
      pdf.rect(50, boxY, boxWidth, boxHeight).fillAndStroke('#f8fafc', '#1e4d8c');
      pdf.font('Helvetica-Bold').fontSize(11).fillColor('#1e4d8c').text('DATI PROFESSIONISTA', 60, boxY + 8);
      pdf.font('Helvetica').fontSize(9).fillColor('#000000');
      let py = boxY + 28;
      pdf.text(`Nominativo: ${nomeProf}`, 60, py, { width: boxWidth - 20, lineGap: 1 });
      py += nameH + 4;
      pdf.text(`Codice Fiscale: ${cf}`, 60, py, { width: boxWidth - 20 });
      py += cfH + 4;
      pdf.text(`P. IVA: ${piva}`, 60, py, { width: boxWidth - 20 });
      py += pivaH + 4;
      pdf.text(`Indirizzo: ${indirizzo}`, 60, py, { width: boxWidth - 20, lineGap: 1 });

      // Descrizione e calcoli
      let calcY = boxY + boxHeight + 30;
      pdf.font('Helvetica-Bold').fontSize(11).fillColor('#1e4d8c').text('Causale / Descrizione', 50, calcY);
      pdf.font('Helvetica').fontSize(9).fillColor('#000000');
      const desc = ritenuta.descrizione || '—';
      const descH = pdf.heightOfString(desc, { width: 500, lineGap: 1 });
      pdf.text(desc, 50, calcY + 16, { width: 500, lineGap: 1 });
      calcY += 24 + descH + 20;

      const colX = [50, 320, 430];
      const colW = [270, 110, 110];
      const rowH = 22;
      pdf.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
      pdf.rect(colX[0], calcY, colW[0], rowH).fillAndStroke('#1e4d8c', '#1e4d8c');
      pdf.rect(colX[1], calcY, colW[1], rowH).fillAndStroke('#1e4d8c', '#1e4d8c');
      pdf.rect(colX[2], calcY, colW[2], rowH).fillAndStroke('#1e4d8c', '#1e4d8c');
      pdf.text('Voce', colX[0] + 5, calcY + 6, { width: colW[0] - 10 });
      pdf.text('Valore', colX[1] + 5, calcY + 6, { width: colW[1] - 10, align: 'right' });

      const rows = [
        ['Importo lordo', formatEuro(ritenuta.importoLordo)],
        [`Ritenuta d'acconto (${ritenuta.percentualeRitenuta || 0}%)`, `- ${formatEuro(ritenuta.importoRitenuta)}`],
        ['Importo bollo', formatEuro(ritenuta.importoBollo)],
        ['Netto a pagare', formatEuro(ritenuta.nettoAPagare)],
      ];

      let rowY = calcY + rowH;
      pdf.font('Helvetica').fontSize(9).fillColor('#000000');
      for (let i = 0; i < rows.length; i++) {
        const isTotal = i === rows.length - 1;
        pdf.rect(colX[0], rowY, colW[0], rowH).fillAndStroke(isTotal ? '#f0fdf4' : '#ffffff', isTotal ? '#16a34a' : '#e2e8f0');
        pdf.rect(colX[1], rowY, colW[1], rowH).fillAndStroke(isTotal ? '#f0fdf4' : '#ffffff', isTotal ? '#16a34a' : '#e2e8f0');
        pdf.rect(colX[2], rowY, colW[2], rowH).fillAndStroke(isTotal ? '#f0fdf4' : '#ffffff', isTotal ? '#16a34a' : '#e2e8f0');
        pdf.font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#000000');
        pdf.text(rows[i][0], colX[0] + 5, rowY + 6, { width: colW[0] - 10 });
        pdf.text(rows[i][1], colX[1] + 5, rowY + 6, { width: colW[1] - 10, align: 'right' });
        rowY += rowH;
      }

      // Testo legale
      let legalY = rowY + 30;
      pdf.font('Helvetica').fontSize(8).fillColor('#555555');
      const legale = [
        `Attestazione di pagamento con ritenuta d'acconto ai sensi del D.P.R. 29 settembre 1973 n. 600 e successive modifiche.`,
        `L'importo della ritenuta verrà versato all'erario unitamente agli altri adempimenti fiscali del committente.`,
        ritenuta.numeroDocumentoProfessionista ? `Numero documento professionista: ${ritenuta.numeroDocumentoProfessionista}` : '',
      ].filter(Boolean);
      for (const line of legale) {
        const h = pdf.heightOfString(line, { width: 500, lineGap: 1 });
        pdf.text(line, 50, legalY, { width: 500, lineGap: 1 });
        legalY += h + 4;
      }

      // Firma
      let signatureY = legalY + 40;
      if (signatureY > 650) {
        pdf.addPage();
        signatureY = 50;
      }

      if (isFirmato && ritenuta.firma?.firmato) {
        pdf.rect(50, signatureY, 500, 110).fillAndStroke('#f0fdf4', '#16a34a');
        pdf.font('Helvetica-Bold').fontSize(11).fillColor('#166534').text('DOCUMENTO FIRMATO DIGITALMENTE', 60, signatureY + 10);
        pdf.font('Helvetica').fontSize(9).fillColor('#000000');
        pdf.text(`Firmato da: ${ritenuta.firma.nome || 'Sottoscrittore'} il ${formatData(ritenuta.firma.firmatoIl)}`, 60, signatureY + 32);
        if (ritenuta.firma.firmaImg) {
          const base64Data = String(ritenuta.firma.firmaImg).replace(/^data:image\/\w+;base64,/, '');
          try {
            const imgBuffer = Buffer.from(base64Data, 'base64');
            pdf.image(imgBuffer, 60, signatureY + 52, { width: 180 });
          } catch (imgErr) {
            console.warn('Errore inserimento firma nel PDF:', (imgErr as Error).message);
          }
        }
      } else {
        pdf.rect(50, signatureY, 500, 100).fillAndStroke('#ffffff', '#e2e8f0');
        pdf.font('Helvetica-Bold').fontSize(10).fillColor('#1e4d8c').text('FIRMA DEL PROFESSIONISTA', 60, signatureY + 10);
        pdf.font('Helvetica').fontSize(9).fillColor('#000000');
        pdf.text('Il professionista, presa visione del presente documento, dichiara l\'esattezza dei dati e autorizza la ritenuta.', 60, signatureY + 28);
        pdf.text('Firma: ____________________________________________    Data: _______________', 60, signatureY + 52);
      }

      // Footer
      pdf.font('Helvetica').fontSize(8).fillColor('#888888').text('Documento generato elettronicamente da Abbraccio Cure Domiciliari S.R.L.S.', 50, 790, { width: 500, align: 'center' });

      pdf.end();
    } catch (err) {
      reject(err);
    }
  });
}

export default generaRitenutaPDF;
