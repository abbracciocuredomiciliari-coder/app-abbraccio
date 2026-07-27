import { Document, Schema, model } from 'mongoose';

export type TipoPacchetto = 'canone' | 'noleggio' | 'ibrido';

export interface IPacchettoTelemedicina extends Document {
  codice: string;
  nome: string;
  descrizione: string;
  tipo: TipoPacchetto;
  prezzoMensile: number;
  prezzoAttivazione: number;
  durataMinimaMesi: number;
  incluseProfessioni: string[];
  dispositiviInclusi: string[];
  visiteIncluse: number;
  parametriInclusi: string[];
  verticali: string[];
  attivo: boolean;
  note?: string;
  creatoDa: string;
}

const pacchettoSchema = new Schema<IPacchettoTelemedicina>(
  {
    codice: { type: String, required: true, unique: true, trim: true },
    nome: { type: String, required: true, trim: true },
    descrizione: { type: String, required: true },
    tipo: { type: String, enum: ['canone', 'noleggio', 'ibrido'], default: 'canone' },
    prezzoMensile: { type: Number, required: true, min: 0 },
    prezzoAttivazione: { type: Number, default: 0, min: 0 },
    durataMinimaMesi: { type: Number, default: 12 },
    incluseProfessioni: [{ type: String }],
    dispositiviInclusi: [{ type: String }],
    visiteIncluse: { type: Number, default: 0 },
    parametriInclusi: [{ type: String }],
    verticali: [{ type: String }],
    attivo: { type: Boolean, default: true },
    note: { type: String },
    creatoDa: { type: String, required: true },
  },
  { timestamps: true }
);

pacchettoSchema.index({ attivo: 1, prezzoMensile: 1 });

export default model<IPacchettoTelemedicina>('PacchettoTelemedicina', pacchettoSchema);
