import { Document, Schema, model } from 'mongoose';

export type TipoConsenso = 'telemedicina' | 'trattamento_dati_salute' | 'video_registrazione' | 'apparecchiature';

export interface IConsensoTelemedicina extends Document {
  pazienteId: string;
  pazienteNome: string;
  tipo: TipoConsenso;
  accettato: boolean;
  versione: string;
  testo: string;
  firmatoIl?: Date;
  firma?: string;
  accettatoDa?: string;
  accettatoDaRuolo?: 'paziente' | 'caregiver' | 'tutore';
  documentoUrl?: string;
  creatoDa: string;
}

const consensoSchema = new Schema<IConsensoTelemedicina>(
  {
    pazienteId: { type: String, required: true, index: true },
    pazienteNome: { type: String, required: true },
    tipo: { type: String, enum: ['telemedicina', 'trattamento_dati_salute', 'video_registrazione', 'apparecchiature'], required: true },
    accettato: { type: Boolean, default: false },
    versione: { type: String, default: '1.0' },
    testo: { type: String, required: true },
    firmatoIl: { type: Date },
    firma: { type: String },
    accettatoDa: { type: String },
    accettatoDaRuolo: { type: String, enum: ['paziente', 'caregiver', 'tutore'] },
    documentoUrl: { type: String },
    creatoDa: { type: String, required: true },
  },
  { timestamps: true }
);

consensoSchema.index({ pazienteId: 1, tipo: 1 });

export default model<IConsensoTelemedicina>('ConsensoTelemedicina', consensoSchema);
