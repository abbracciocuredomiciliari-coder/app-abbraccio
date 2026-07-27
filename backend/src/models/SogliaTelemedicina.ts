import { Document, Schema, model } from 'mongoose';

export interface ISogliaTelemedicina extends Document {
  pazienteId?: string;
  pazienteNome?: string;
  tipoParametro: string;
  professione?: string;
  min?: number;
  max?: number;
  unita: string;
  note?: string;
  attiva: boolean;
  creatoDa: string;
}

const sogliaSchema = new Schema<ISogliaTelemedicina>(
  {
    pazienteId: { type: String, index: true },
    pazienteNome: { type: String },
    tipoParametro: { type: String, required: true },
    professione: { type: String },
    min: { type: Number },
    max: { type: Number },
    unita: { type: String, required: true },
    note: { type: String },
    attiva: { type: Boolean, default: true },
    creatoDa: { type: String, required: true },
  },
  { timestamps: true }
);

sogliaSchema.index({ pazienteId: 1, tipoParametro: 1 });

export default model<ISogliaTelemedicina>('SogliaTelemedicina', sogliaSchema);
