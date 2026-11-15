import { Schema, model, Document } from 'mongoose';

// Contenuti hero dei siti pubblici (principale / famiglie / shop),
// modificabili dal gestionale → sezione "Siti web e Shop".
// Campi vuoti = il sito mostra il proprio contenuto originale.
export type SiteId = 'main' | 'family' | 'shop';

export interface ISiteContent extends Document {
  site: SiteId;
  title: string;
  subtitle: string;
  photo: string; // URL relativo /site-media/<file> oppure vuoto
  video: string;
  updatedByName?: string;
  storico: { at: Date; by?: string; campo: string; valore: string; precedente?: string }[];
}

const schema = new Schema<ISiteContent>(
  {
    site: { type: String, enum: ['main', 'family', 'shop'], required: true, unique: true },
    title: { type: String, default: '', trim: true },
    subtitle: { type: String, default: '', trim: true },
    photo: { type: String, default: '' },
    video: { type: String, default: '' },
    updatedByName: { type: String, trim: true },
    storico: [{ at: { type: Date, default: Date.now }, by: String, campo: String, valore: String, precedente: String }],
  },
  { timestamps: true }
);

export default model<ISiteContent>('SiteContent', schema);
