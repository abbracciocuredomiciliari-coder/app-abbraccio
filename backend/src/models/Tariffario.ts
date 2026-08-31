import { Document, Schema, model } from 'mongoose';

export interface ITariffario extends Document {
  categoria: 'prestazioni_infermieristiche' | 'assistenza_trasporto' | 'radiologia' | 'ecografia';
  nome: string;
  prezzo: number;
  unitaMisura?: string; // es. "1 tratto", "cad", "ora"
  note?: string;
  attivo: boolean;
  ordine: number;
  aggiornatoDa?: string;
}

const tariffarioSchema = new Schema<ITariffario>(
  {
    categoria: {
      type: String,
      required: true,
      enum: ['prestazioni_infermieristiche', 'assistenza_trasporto', 'radiologia', 'ecografia'],
    },
    nome: { type: String, required: true, trim: true },
    prezzo: { type: Number, required: true, default: 0 },
    unitaMisura: { type: String, trim: true },
    note: { type: String, trim: true },
    attivo: { type: Boolean, default: true },
    ordine: { type: Number, default: 0 },
    aggiornatoDa: { type: String, trim: true },
  },
  { timestamps: true }
);

tariffarioSchema.index({ categoria: 1, ordine: 1 });

export default model<ITariffario>('Tariffario', tariffarioSchema);
