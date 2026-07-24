import { Document, Schema, model } from 'mongoose';

export interface IConsensoPrestazioneSanitaria extends Document {
  patientId: string;
  firmatoDa: 'paziente' | 'caregiver' | 'tutore' | 'rappresentanteLegale';
  nomeFirmatario: string;
  cognomeFirmatario: string;
  relazioneConPaziente?: string;
  prestazioneSanitaria: boolean;
  rischiTrattamento: boolean;
  firmaDigitale: string;
  dataFirma: Date;
  versioneDocumento: string;
  operatoreId: string;
  operatoreEmail: string;
  ipAddress?: string;
  userAgent?: string;
  revocato: boolean;
  dataRevoca?: Date;
  motivoRevoca?: string;
  createdAt: Date;
  updatedAt: Date;
}

const consensoPrestazioneSanitariaSchema = new Schema<IConsensoPrestazioneSanitaria>(
  {
    patientId: { type: String, required: true, index: true },
    firmatoDa: { type: String, enum: ['paziente', 'caregiver', 'tutore', 'rappresentanteLegale'], required: true },
    nomeFirmatario: { type: String, required: true, trim: true },
    cognomeFirmatario: { type: String, required: true, trim: true },
    relazioneConPaziente: { type: String, trim: true },
    prestazioneSanitaria: { type: Boolean, required: true },
    rischiTrattamento: { type: Boolean, required: true },
    firmaDigitale: { type: String, required: true },
    dataFirma: { type: Date, default: Date.now },
    versioneDocumento: { type: String, required: true },
    operatoreId: { type: String, required: true },
    operatoreEmail: { type: String, required: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    revocato: { type: Boolean, default: false },
    dataRevoca: { type: Date },
    motivoRevoca: { type: String },
  },
  { timestamps: true }
);

consensoPrestazioneSanitariaSchema.index({ patientId: 1, revocato: 1 });
consensoPrestazioneSanitariaSchema.index({ dataFirma: -1 });

export default model<IConsensoPrestazioneSanitaria>('ConsensoPrestazioneSanitaria', consensoPrestazioneSanitariaSchema);
