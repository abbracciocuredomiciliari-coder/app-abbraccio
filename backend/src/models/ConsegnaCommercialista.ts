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
}

export interface IConsegnaCommercialista extends Document {
  periodoDal?: Date;
  periodoAl?: Date;
  tipologie: string[];
  documenti: IDocConsegnato[];
  anomalie?: string[];              // segnalazioni rilevate in preparazione
  preparataIl: Date;
  preparataDa?: string;
  stato: 'preparata' | 'consegnata' | 'verificata';
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
  },
  { _id: false }
);

const schema = new Schema<IConsegnaCommercialista>(
  {
    periodoDal: { type: Date },
    periodoAl: { type: Date },
    tipologie: [{ type: String }],
    documenti: { type: [docSchema], default: [] },
    anomalie: [{ type: String }],
    preparataIl: { type: Date, default: Date.now },
    preparataDa: { type: String, trim: true },
    stato: { type: String, enum: ['preparata', 'consegnata', 'verificata'], default: 'preparata', index: true },
    consegnataIl: { type: Date },
    consegnataDa: { type: String, trim: true },
    modalitaConsegna: { type: String, trim: true },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

schema.index({ preparataIl: -1 });

export default model<IConsegnaCommercialista>('ConsegnaCommercialista', schema);
