import { Document, Schema, model } from 'mongoose';

export interface IPacchettoTelemedicina extends Document {
  codice: string;
  nome: string;
  descrizione: string;
  prezzoMensile: number;
  durataMinimaMesi: number;
  incluseProfessioni: string[];
  dispositiviInclusi: string[];
  visiteIncluse: number;
  parametriInclusi: string[];
  attivo: boolean;
  note?: string;
  creatoDa: string;
}

const pacchettoSchema = new Schema<IPacchettoTelemedicina>(
  {
    codice: { type: String, required: true, unique: true, trim: true },
    nome: { type: String, required: true, trim: true },
    descrizione: { type: String, required: true },
    prezzoMensile: { type: Number, required: true, min: 0 },
    durataMinimaMesi: { type: Number, default: 12 },
    incluseProfessioni: [{ type: String }],
    dispositiviInclusi: [{ type: String }],
    visiteIncluse: { type: Number, default: 0 },
    parametriInclusi: [{ type: String }],
    attivo: { type: Boolean, default: true },
    note: { type: String },
    creatoDa: { type: String, required: true },
  },
  { timestamps: true }
);

pacchettoSchema.index({ attivo: 1, prezzoMensile: 1 });

export default model<IPacchettoTelemedicina>('PacchettoTelemedicina', pacchettoSchema);
