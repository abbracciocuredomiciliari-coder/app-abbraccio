import { Schema, model, Document } from 'mongoose';

// Recensioni mostrate nella sezione "Cosa dicono di noi" dei tre siti pubblici.
// Gestite dal gestionale → Siti web e Shop → Recensioni.
export type SiteId = 'main' | 'family' | 'shop';

export interface ISiteReview extends Document {
  site: SiteId;
  nome: string;        // es. "Maria G." o "Famiglia Rossi"
  ruolo?: string;      // es. "Badante convivente · Roma"
  rating: number;      // 1-5
  testo: string;
  approvato: boolean;  // solo le approvate compaiono sul sito
  ordine: number;
}

const schema = new Schema<ISiteReview>(
  {
    site: { type: String, enum: ['main', 'family', 'shop'], required: true, index: true },
    nome: { type: String, required: true, trim: true },
    ruolo: { type: String, trim: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    testo: { type: String, required: true, trim: true },
    approvato: { type: Boolean, default: true },
    ordine: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default model<ISiteReview>('SiteReview', schema);
