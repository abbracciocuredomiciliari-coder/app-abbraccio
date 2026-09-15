import { Schema, model, Types, Document } from 'mongoose';

export interface IBadanteIntermediazione extends Document {
  patient: Types.ObjectId;
  contrattoTipo: 'orario_non_convivente' | 'convivente';
  livello: 'A' | 'AS' | 'B' | 'BS' | 'C' | 'CS' | 'D' | 'DS';
  oreSettimanali?: number;
  mesiContratto?: number;
  costoMensile?: number;
  gestioneAmministrativa?: number;
  note?: string;
  stato: 'aperta' | 'preventivo_emesso' | 'accettata' | 'fatturata' | 'annullata';
  preventivoId?: Types.ObjectId;
  fatturaId?: Types.ObjectId;
  fattureGestione?: Types.ObjectId[];
  creatoDa: string;
  createdAt: Date;
  updatedAt: Date;
}

const badanteIntermediazioneSchema = new Schema<IBadanteIntermediazione>(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    contrattoTipo: { type: String, enum: ['orario_non_convivente', 'convivente'], required: true },
    livello: { type: String, enum: ['A', 'AS', 'B', 'BS', 'C', 'CS', 'D', 'DS'], required: true },
    oreSettimanali: { type: Number, min: 0 },
    mesiContratto: { type: Number, min: 0 },
    costoMensile: { type: Number, min: 0 },
    gestioneAmministrativa: { type: Number, min: 0, default: 0 },
    note: { type: String, trim: true },
    stato: { type: String, enum: ['aperta', 'preventivo_emesso', 'accettata', 'fatturata', 'annullata'], default: 'aperta' },
    preventivoId: { type: Schema.Types.ObjectId, ref: 'DocumentoFatturazione' },
    fatturaId: { type: Schema.Types.ObjectId, ref: 'DocumentoFatturazione' },
    fattureGestione: [{ type: Schema.Types.ObjectId, ref: 'DocumentoFatturazione' }],
    creatoDa: { type: String, required: true },
  },
  { timestamps: true }
);

badanteIntermediazioneSchema.index({ patient: 1 });
badanteIntermediazioneSchema.index({ stato: 1 });

export default model<IBadanteIntermediazione>('BadanteIntermediazione', badanteIntermediazioneSchema);
