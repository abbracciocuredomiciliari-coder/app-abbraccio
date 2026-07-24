import { Schema, model, Document } from 'mongoose';

export interface ISchedaDimissione extends Document {
  patientId: string;
  dataInizioServizio?: Date;
  dataDimissione: Date;
  motivazioni: string[];
  altroMotivo?: string;
  relazioneChiusura: string;
  firmaCoordinatore: string;
  coordinatoreId: string;
  coordinatoreNome: string;
  createdAt: Date;
  updatedAt: Date;
}

const schedaDimissioneSchema = new Schema<ISchedaDimissione>({
  patientId: { type: String, required: true, index: true },
  dataInizioServizio: { type: Date },
  dataDimissione: { type: Date, required: true },
  motivazioni: [{ type: String, required: true }],
  altroMotivo: { type: String, trim: true },
  relazioneChiusura: { type: String, required: true, trim: true },
  firmaCoordinatore: { type: String, required: true },
  coordinatoreId: { type: String, required: true },
  coordinatoreNome: { type: String, required: true },
}, { timestamps: true });

schedaDimissioneSchema.index({ patientId: 1, dataDimissione: -1 });
export default model<ISchedaDimissione>('SchedaDimissione', schedaDimissioneSchema);
