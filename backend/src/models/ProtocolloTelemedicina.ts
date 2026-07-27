import { Document, Schema, model } from 'mongoose';

export interface IProtocolloTelemedicina extends Document {
  nome: string;
  professione: string;
  descrizione: string;
  passi: string[];
  esercizi: string[];
  questionari: string[];
  soglieTipo: string[];
  attivo: boolean;
  creatoDa: string;
}

const protocolloSchema = new Schema<IProtocolloTelemedicina>(
  {
    nome: { type: String, required: true, trim: true },
    professione: { type: String, required: true },
    descrizione: { type: String, required: true },
    passi: [{ type: String }],
    esercizi: [{ type: String }],
    questionari: [{ type: String }],
    soglieTipo: [{ type: String }],
    attivo: { type: Boolean, default: true },
    creatoDa: { type: String, required: true },
  },
  { timestamps: true }
);

protocolloSchema.index({ professione: 1, attivo: 1 });

export default model<IProtocolloTelemedicina>('ProtocolloTelemedicina', protocolloSchema);
