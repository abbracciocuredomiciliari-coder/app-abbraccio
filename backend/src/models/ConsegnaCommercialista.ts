import { Document, Schema, model } from 'mongoose';

// ═════════════════════════════════════════════════════════════════════════════
// CONSEGNA COMMERCIALISTA — registro delle preparazioni documentali per il
// commercialista. Ogni preparazione conserva lo snapshot dei documenti
// inclusi (numero/soggetto/data/totale) così una preparazione successiva può
// evidenziare documenti aggiunti o modificati dopo la consegna precedente.
// Esportazione ≠ invio: la consegna va marcata esplicitamente.
// ═════════════════════════════════════════════════════════════════════════════

export interface IDocConsegnato {
  origine: string;         // fattura | preventivo | nota_credito | fattura_ricevuta | ritenuta | invio
  rifId: string;
  numero: string;
  soggetto: string;
  data?: Date;
  totale?: number;
  aggiornatoIl?: Date;     // per rilevare modifiche successive alla consegna
  haOriginale?: boolean;   // originale disponibile nel pacchetto ZIP
}

export interface IConsegnaCommercialista extends Document {
  periodoDal?: Date;
  periodoAl?: Date;
  tipologie: string[];
  aree?: string[];                  // filtro aree usato in preparazione (vuoto = tutte)
  documenti: IDocConsegnato[];
  anomalie?: string[];              // segnalazioni rilevate in preparazione
  preparataIl: Date;
  preparataDa?: string;
  stato: 'preparata' | 'scaricata' | 'consegnata' | 'verificata';
  scaricataIl?: Date;               // download pacchetto ≠ consegna
  scaricataDa?: string;
  consegnataIl?: Date;
  consegnataDa?: string;
  modalitaConsegna?: string;        // email, chiavetta, accesso diretto, altro
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const docSchema = new Schema<IDocConsegnato>(
  {
    origine: { type: String, required: true },
    rifId: { type: String, required: true },
    numero: { type: String },
    soggetto: { type: String },
    data: { type: Date },
    totale: { type: Number },
    aggiornatoIl: { type: Date },
    haOriginale: { type: Boolean },
  },
  { _id: false }
);

const schema = new Schema<IConsegnaCommercialista>(
  {
    periodoDal: { type: Date },
    periodoAl: { type: Date },
    tipologie: [{ type: String }],
    aree: [{ type: String }],
    documenti: { type: [docSchema], default: [] },
    anomalie: [{ type: String }],
    preparataIl: { type: Date, default: Date.now },
    preparataDa: { type: String, trim: true },
    stato: { type: String, enum: ['preparata', 'scaricata', 'consegnata', 'verificata'], default: 'preparata', index: true },
    scaricataIl: { type: Date },
    scaricataDa: { type: String, trim: true },
    consegnataIl: { type: Date },
    consegnataDa: { type: String, trim: true },
    modalitaConsegna: { type: String, trim: true },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

schema.index({ preparataIl: -1 });

export default model<IConsegnaCommercialista>('ConsegnaCommercialista', schema);
