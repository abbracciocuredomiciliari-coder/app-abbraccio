const fs = require('fs');
const path = require('path');
const { generaMandatoRxTeamPDF } = require('../dist/utils/mandatoRxTeamPdf');

const mandatoEsempio = {
  nPratica: 'RX-202610-4821',
  dataRichiesta: new Date('2026-10-09'),
  operatoreAbbraccio: 'Simona Schembri',
  esami: [
    { tipo: 'rx_domiciliare', dettaglio: 'Torace in due proiezioni' },
    { tipo: 'ecografia_domiciliare', dettaglio: 'Addome completo' },
  ],
  prescrizioneMedica: 'allegata',
  quesitoClinico: 'Dispnea e dolore toracico da valutare, paziente allettato non trasportabile.',
  compenso: 90,
  dataEsecuzione: '15/10/2026',
  fasciaOraria: '9:00 - 12:00',
  referenteRxTeam: 'Dott. Marco Bianchi',
  recapitoNote: '351 0000000',
  accessoInfo: {
    allettato: true,
    deambulante: false,
    carrozzina: false,
    ascensore: true,
    scaleAccessoDifficoltoso: false,
    ossigenoterapia: true,
  },
  noteOrganizzative: 'Citofonare "Rossi", secondo piano con ascensore.',
  stato: 'emesso',
};

const pazienteEsempio = {
  firstName: 'Maria',
  lastName: 'Rossi',
  birthDate: new Date('1942-03-12'),
  contactPhone: '333 1234567',
  address: 'Via Roma 10, 00100 Roma (RM)',
};

(async () => {
  const buffer = await generaMandatoRxTeamPDF(mandatoEsempio, pazienteEsempio);
  const outDir = 'C:/Users/Fin/Desktop/RX TEAM';
  const outPath = path.join(outDir, 'Foglio_Accompagnamento_Abbraccio_RX_Team_GENERATO.pdf');
  fs.writeFileSync(outPath, buffer);
  console.log('PDF generato in:', outPath);
})().catch((err) => {
  console.error('Errore generazione PDF:', err);
  process.exit(1);
});
