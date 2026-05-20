import { Document, Schema, model } from 'mongoose';

export interface IMedicalSupply extends Document {
  nome: string;
  quantita: number;
  scadenza?: Date;
  unitaMisura?: string; // es. "pezzi", "confezioni", "scatole"
  scortaMinima?: number;
  category?: string; // es. "presidio", "farmaco"
  dosaggio?: string; // solo per farmaci
  createdAt: Date;
  updatedAt: Date;
}

const medicalSupplySchema = new Schema<IMedicalSupply>(
  {
    nome: { type: String, required: true, trim: true },
    quantita: { type: Number, required: true, default: 0, min: 0 },
    scadenza: { type: Date },
    unitaMisura: { type: String, default: 'pezzi', trim: true },
    scortaMinima: { type: Number, default: 0 },
    category: { type: String, default: 'presidio', trim: true },
    dosaggio: { type: String, trim: true },
  },
  { timestamps: true }
);

// Index for unique name per category
medicalSupplySchema.index({ nome: 1, category: 1 }, { unique: true });

export default model<IMedicalSupply>('MedicalSupply', medicalSupplySchema);
