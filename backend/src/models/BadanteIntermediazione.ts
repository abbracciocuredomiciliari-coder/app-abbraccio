import { Schema, model, Types, Document } from 'mongoose';

export interface IBadanteIntermediazione extends Document {
  patient: Types.ObjectId;
  tipoPiano: 'orario' | 'contratto_nazionale';
  oreSettimanali?: number;
  mesiContratto?: number;
  costoMensile?: number;
  tariffaOraria?: number;
  note?: string;
  stato: 'aperta' | 'preventivo_emesso' | 'accettata' | 'fatturata' | 'annullata';
  preventivoId?: Types.ObjectId;
  fatturaId?: Types.ObjectId;
  creatoDa: string;
  createdAt: Date;
  updatedAt: Date;
}

const badanteIntermediazioneSchema = new Schema<IBadanteIntermediazione>(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    tipoPiano: { type: String, enum: ['orario', 'contratto_nazionale'], required: true },
    oreSettimanali: { type: Number, min: 0 },
    mesiContratto: { type: Number, min: 0 },
    costoMensile: { type: Number, min: 0 },
    tariffaOraria: { type: Number, min: 0 },
    note: { type: String, trim: true },
    stato: { type: String, enum: ['aperta', 'preventivo_emesso', 'accettata', 'fatturata', 'annullata'], default: 'aperta' },
    preventivoId: { type: Schema.Types.ObjectId, ref: 'DocumentoFatturazione' },
    fatturaId: { type: Schema.Types.ObjectId, ref: 'DocumentoFatturazione' },
    creatoDa: { type: String, required: true },
  },
  { timestamps: true }
);

badanteIntermediazioneSchema.index({ patient: 1 });
badanteIntermediazioneSchema.index({ stato: 1 });

export default model<IBadanteIntermediazione>('BadanteIntermediazione', badanteIntermediazioneSchema);
