import { Document, Schema, model, Types } from 'mongoose';

// ═════════════════════════════════════════════════════════════════════════════
// FATTURA RICEVUTA — documenti in ingresso da fornitori e professionisti
// generici (non legati a una RitenutaAcconto: quelli restano in
// DocumentoProfessionista). Area di provenienza conservata per i filtri
// dell'Amministrazione centrale.
// ═════════════════════════════════════════════════════════════════════════════

export interface IFatturaRicevuta extends Document {
  fornitore: {
    nome: string;
    partitaIva?: string;
    codiceFiscale?: string;
    email?: string;
  };
  numero: string;
  data: Date;
  imponibile?: number;
  iva?: number;
  totale: number;
  descrizione?: string;
  area: 'privato' | 'intermediazione' | 'convenzione' | 'trasversale';
  // Collegamento opzionale alla pratica (paziente, intermediazione, documento)
  praticaTipo?: string;
  praticaId?: Types.ObjectId;
  praticaLabel?: string;
  scadenzaPagamento?: Date;
  pagamento?: {
    stato?: 'da_pagare' | 'parziale' | 'pagata';
    pagamenti?: {
      data: Date;
      importo: number;
      metodo?: string;
      nota?: string;
      registratoDa?: string;
    }[];
  };
  allegato?: {
    fileName: string;
    contentType: string;
    contenuto: Buffer;
  };
  creatoDa?: string;
  createdAt: Date;
  updatedAt: Date;
}

const fatturaRicevutaSchema = new Schema<IFatturaRicevuta>(
  {
    fornitore: {
      nome: { type: String, required: true, trim: true },
      partitaIva: { type: String, trim: true },
      codiceFiscale: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    numero: { type: String, required: true, trim: true },
    data: { type: Date, required: true, default: Date.now },
    imponibile: { type: Number },
    iva: { type: Number },
    totale: { type: Number, required: true, default: 0 },
    descrizione: { type: String, trim: true },
    area: { type: String, enum: ['privato', 'intermediazione', 'convenzione', 'trasversale'], default: 'trasversale', index: true },
    praticaTipo: { type: String, trim: true },
    praticaId: { type: Schema.Types.ObjectId },
    praticaLabel: { type: String, trim: true },
    scadenzaPagamento: { type: Date },
    pagamento: {
      stato: { type: String, enum: ['da_pagare', 'parziale', 'pagata'], default: 'da_pagare' },
      pagamenti: [{
        data: { type: Date, default: Date.now },
        importo: { type: Number, required: true },
        metodo: { type: String, trim: true },
        nota: { type: String, trim: true },
        registratoDa: { type: String, trim: true },
      }],
    },
    allegato: {
      fileName: { type: String },
      contentType: { type: String, default: 'application/pdf' },
      contenuto: { type: Buffer },
    },
    creatoDa: { type: String, trim: true },
  },
  { timestamps: true }
);

fatturaRicevutaSchema.index({ 'fornitore.nome': 1, data: -1 });
fatturaRicevutaSchema.index({ scadenzaPagamento: 1, 'pagamento.stato': 1 });

export default model<IFatturaRicevuta>('FatturaRicevuta', fatturaRicevutaSchema);
