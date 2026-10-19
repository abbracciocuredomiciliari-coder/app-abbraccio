// ─── Generazione PDF preventivo assistente familiare ──────────────────────────
// Replica il template dei preventivi Abbraccio/RSD (cfr. preventivi Nunzia Coccola
// e Giuseppe Bilotti): header RSD + PREVENTIVO, blocco società Abbraccio, loghi
// partner, tabella DESCRIZIONE/ORE MENSILI/RETRIBUZIONE/TOTALE con le voci
// costo/netto/trattenute/CAF, termini e condizioni, footer ROMA.
// I valori arrivano da simulaCostoBadante (CCNL/INPS 2026).

import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import type { Response } from 'express';
import type { SimulazioneCosto } from './costoBadante';

const PUB = (...p: string[]) => path.join(process.cwd(), 'public', 'preventivo', ...p);
const hasImg = (p: string) => { try { return fs.existsSync(p); } catch { return false; } };

const fmt = (n: number) =>
  n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface PreventivoPdfOpts {
  intestatario?: string;   // nome cliente/famiglia (opzionale)
  cafMensile?: number;     // quota CAF sanitario mensile (default 150)
}

export function generaPreventivoBadantePdf(res: Response, sim: SimulazioneCosto, opts: PreventivoPdfOpts = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="preventivo-assistente-familiare.pdf"`);
  doc.pipe(res);

  const W = 595.28;
  const margin = 50;
  const contentW = W - margin * 2;
  const brand = '#8c1d40';       // borgogna/rosa brand Abbraccio
  const accent = '#0d6e63';      // verde RSD/CAF
  let y = 45;

  // ── Header: logo RSD sinistra, PREVENTIVO destra ──
  const rsd = PUB('logo-rsd.jpg');
  if (hasImg(rsd)) doc.image(rsd, margin, y, { width: 78 });
  doc.font('Times-Bold').fontSize(19).fillColor('#000')
    .text('P R E V E N T I V O', margin, y + 12, { width: contentW, align: 'right' });
  y += 78;

  // ── Blocco società centrato ──
  const logoAb = PUB('logo-abbraccio.jpg');
  if (hasImg(logoAb)) {
    doc.image(logoAb, W / 2 - 55, y, { width: 110 });
    y += 46;
  }
  doc.font('Times-Bold').fontSize(12.5).fillColor('#000')
    .text('ABBRACCIO CURE DOMICILIARI S.R.L.S.', margin, y, { width: contentW, align: 'center', characterSpacing: 1 });
  y += 16;
  doc.font('Times-Roman').fontSize(9.5)
    .text('ASSISTENZA DOMICILIARE INTEGRATA', margin, y, { width: contentW, align: 'center', characterSpacing: 1.5 });
  y += 13;
  doc.text('VIA DI S. MARIA AUSILIATRICE N° 4/B – 00181 ROMA (RM)', margin, y, { width: contentW, align: 'center', characterSpacing: 0.5 });
  y += 12;
  doc.text('C.F. E P. IVA 18316251000', margin, y, { width: contentW, align: 'center', characterSpacing: 0.5 });
  y += 12;
  doc.text('PEC: ABBRACCIOCUREDOMICILIARI@FACILEPEC.COM', margin, y, { width: contentW, align: 'center', characterSpacing: 0.5 });
  y += 34;

  // ── Loghi partner ──
  const fam = PUB('family-assistant.jpg');
  const caf = PUB('caf-sanitario.jpg');
  if (hasImg(fam)) doc.image(fam, margin + 40, y, { width: 85 });
  if (hasImg(caf)) doc.image(caf, W - margin - 40 - 55, y, { width: 55 });
  y += 52;

  // ── Intestatario + data (opzionali) ──
  if (opts.intestatario) {
    doc.font('Times-Bold').fontSize(10.5).fillColor('#000')
      .text(`Cliente: ${opts.intestatario}`, margin, y, { width: contentW });
    y += 14;
  }
  const dataStr = new Date().toLocaleDateString('it-IT');
  doc.font('Times-Roman').fontSize(9.5).fillColor('#333')
    .text(`Roma, ${dataStr}`, margin, y, { width: contentW, align: 'right' });
  y += 18;

  // ── Tabella ──
  const colDesc = margin;
  const colOre = margin + contentW * 0.52;
  const colRetr = margin + contentW * 0.66;
  const colTot = margin + contentW * 0.82;
  const rowPad = 6;

  const drawRow = (cells: { desc: string[]; ore?: string; retr?: string; tot?: string; bold?: boolean; fill?: string }, lineAfter = true) => {
    const descH = Math.max(...cells.desc.map(t => doc.heightOfString(t, { width: colOre - colDesc - 12 })));
    const h = descH + rowPad * 2;
    if (cells.fill) {
      doc.save().rect(colDesc, y, contentW, h).fill(cells.fill).restore();
    }
    doc.font(cells.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#000');
    cells.desc.forEach((t, i) => doc.text(t, colDesc + 8, y + rowPad + i * 12, { width: colOre - colDesc - 12 }));
    if (cells.ore) doc.text(cells.ore, colOre, y + rowPad, { width: colRetr - colOre - 8 });
    if (cells.retr) doc.text(cells.retr, colRetr, y + rowPad, { width: colTot - colRetr - 8 });
    if (cells.tot) doc.text(cells.tot, colTot, y + rowPad, { width: margin + contentW - colTot, align: 'right' });
    y += h;
    if (lineAfter) doc.moveTo(colDesc, y).lineTo(colDesc + contentW, y).lineWidth(0.6).strokeColor('#000').stroke();
  };

  // header tabella
  doc.moveTo(colDesc, y).lineTo(colDesc + contentW, y).lineWidth(1).strokeColor('#000').stroke();
  drawRow({ desc: ['DESCRIZIONE'], ore: 'ORE MENSILI', retr: 'RETRIBUZIONE', tot: 'TOTALE', bold: true, fill: '#f3e6ec' });

  const cafQuota = opts.cafMensile ?? 150;
  const contributiTotali = Math.round((sim.contribInpsLavoratoreMensili + sim.contribInpsDatoreMensili
    + sim.cassaColfLavoratoreMensili + sim.cassaColfDatoreMensili) * 100) / 100;
  const totaleDocumento = Math.round((sim.retribuzioneNetta + contributiTotali + cafQuota) * 100) / 100;

  // 1) Costo mensile (lordo)
  drawRow({
    desc: ['Costo mensile Assistente Familiare'],
    ore: `${Math.round(sim.oreMensili)}h`,
    retr: `${fmt(sim.retribuzioneOrariaTotale)}/h`,
    tot: fmt(sim.retribuzioneLordaMensile),
  });

  // 2) Netto mensile
  drawRow({
    desc: ['Netto mensile Assistente Familiare'],
    tot: fmt(sim.retribuzioneNetta),
  });

  // 3) Trattenute
  drawRow({
    desc: ['TRATTENUTE', 'Contributi', 'T.F.R', 'Tredicesima'],
    retr: fmt(contributiTotali),
    tot: fmt(contributiTotali),
  });

  // 4) CAF sanitario
  drawRow({
    desc: ['CAF SANITARIO - Pratiche di assunzione e comunicazioni obbligatorie - Elaborazione buste paga e adempimenti mensili - Assistenza fiscale e consulenza CAF sanitario - Gestione Operatore Domiciliare'],
    retr: fmt(cafQuota),
    tot: fmt(cafQuota),
  });

  // chiusura tabella
  doc.moveTo(colDesc, y).lineTo(colDesc + contentW, y).lineWidth(1).stroke();

  // TOTALE
  y += 16;
  doc.font('Times-Bold').fontSize(12.5).fillColor('#000')
    .text(`TOTALE: ${fmt(totaleDocumento)} €`, margin, y, { width: contentW, align: 'right' });
  y += 30;

  // ── Termini e condizioni ──
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000').text('TERMINI E CONDIZIONI:', margin, y, { width: contentW });
  y += 13;
  doc.font('Helvetica-Oblique').fontSize(8.5).text('Clausola di variazione e precisazioni economiche', margin, y, { width: contentW });
  y += 13;
  doc.font('Helvetica').fontSize(8.5)
    .text('Il presente preventivo potrebbe essere soggetto a variazioni indipendenti dalla nostra volontà, in quanto: il rapporto di lavoro è regolato dal Contratto Collettivo Nazionale del Lavoro (CCNL) e dalle normative fiscali e previdenziali in continua evoluzione; le tariffe contrattuali, i contributi obbligatori e gli oneri di gestione possono subire aggiornamenti automatici stabiliti dagli enti competenti; la disponibilità delle risorse umane da ricercare (assistenti familiari, sostituzioni, figure assistenziali) può influire sulle tempistiche di attivazione del servizio e sulle relative condizioni economiche, in base al livello professionale, all’esperienza e alla reperibilità sul territorio.', margin, y, { width: contentW, align: 'left', lineGap: 2 });
  y = doc.y + 12;
  doc.text('Inoltre, sono incluse nel seguente preventivo:', margin, y, { width: contentW });
  y = doc.y + 6;
  doc.text('Tredicesima mensilità (maturata mensilmente e corrisposta a dicembre)', margin, y, { width: contentW });
  y = doc.y + 6;
  doc.text('Trattamento di Fine Rapporto (TFR), maturato proporzionalmente al periodo di lavoro prestato.', margin, y, { width: contentW });
  y = doc.y + 14;
  doc.text('Il TFR indicato in preventivo è puramente stimato. Sarà liquidato esclusivamente a fine rapporto e non può essere erogato o rateizzato mensilmente in busta paga. I contributi verranno versati trimestralmente.', margin, y, { width: contentW, lineGap: 2 });
  y = doc.y + 10;
  doc.text('P.s. I dati potrebbero essere soggetti a variazione', margin, y, { width: contentW });

  // ── Dettaglio rapporto simulato (box informativo) ──
  y = doc.y + 22;
  doc.save().roundedRect(margin, y, contentW, 52, 6).fill('#f7f4f2').restore();
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(brand)
    .text('RAPPORTO SIMULATO', margin + 12, y + 8);
  doc.font('Helvetica').fontSize(8.5).fillColor('#333')
    .text(`${sim.contrattoLabel} · ${sim.livelloLabel} · ${sim.oreSettimanali} ore a settimana · Paga minima CCNL 2026: ${fmt(sim.pagaBaseCcnl)} €/${sim.pagaUnitaria === 'ora' ? 'ora' : 'mese'}`, margin + 12, y + 22, { width: contentW - 24 });
  doc.text(`Retribuzione oraria effettiva ${fmt(sim.retribuzioneOrariaEffettiva)} €/h · Ferie maturate ${fmt(sim.ferieMensiliOre)} ore/mese${sim.vittoAlloggioGiorno ? ` · Vitto e alloggio in natura ${fmt(sim.vittoAlloggioGiorno)} €/g` : ''}`, margin + 12, y + 34, { width: contentW - 24 });
  y += 52;

  // ── Footer: logo RSD + ROMA ──
  const footerY = 780;
  if (hasImg(rsd)) doc.image(rsd, W / 2 - 32, footerY - 40, { width: 64 });
  doc.font('Times-Bold').fontSize(13).fillColor('#000')
    .text('ROMA', margin, footerY + 8, { width: contentW, align: 'center', characterSpacing: 2 });

  doc.end();
}
