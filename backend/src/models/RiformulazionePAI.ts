import { Schema, model, Document } from 'mongoose';

interface IAllegatoPAI {
  nome: string;
  tipo: string;
  dati: string;
}

export interface IRiformulazionePAI extends Document {
  patientId: string;
  workPlanId?: string;
  tipo: 'riformulazione' | 'rinnovo';
  tipologiaPrestazione: string;
  motivazioni: string;
  relazioneVerbale: string;
  allegati: IAllegatoPAI[];
  firmaCoordinatore: string;
  coordinatoreId: string;
  coordinatoreNome: string;
  dataScheda: Date;
  createdAt: Date;
  updatedAt: Date;
}

const allegatoSchema = new Schema<IAllegatoPAI>({
  nome: { type: String, required: true },
  tipo: { type: String, required: true },
  dati: { type: String, required: true },
}, { _id: false });

const riformulazionePAISchema = new Schema<IRiformulazionePAI>({
  patientId: { type: String, required: true, index: true },
  workPlanId: { type: String },
  tipo: { type: String, enum: ['riformulazione', 'rinnovo'], required: true },
  tipologiaPrestazione: { type: String, required: true, trim: true },
  motivazioni: { type: String, required: true, trim: true },
  relazioneVerbale: { type: String, required: true, trim: true },
  allegati: { type: [allegatoSchema], default: [] },
  firmaCoordinatore: { type: String, required: true },
  coordinatoreId: { type: String, required: true },
  coordinatoreNome: { type: String, required: true },
  dataScheda: { type: Date, default: Date.now },
}, { timestamps: true });

riformulazionePAISchema.index({ patientId: 1, dataScheda: -1 });
export default model<IRiformulazionePAI>('RiformulazionePAI', riformulazionePAISchema);
