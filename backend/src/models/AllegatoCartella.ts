import { Document, Schema, model, Types } from 'mongoose';

export interface IAllegatoCartella extends Document {
  workPlan: Types.ObjectId;
  patient: Types.ObjectId;
  nomeFile: string;         // nome originale del file
  nomeFileServer: string;   // nome salvato sul server (univoco)
  mimeType: string;
  dimensione: number;       // bytes
  descrizione?: string;
  caricatoDa: string;       // nome utente
  caricatoDaId: Types.ObjectId;
  dataCaricamento: Date;
}

const allegatoCartellaSchema = new Schema<IAllegatoCartella>(
  {
    workPlan: { type: Schema.Types.ObjectId, ref: 'WorkPlan', required: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    nomeFile: { type: String, required: true },
    nomeFileServer: { type: String, required: true },
    mimeType: { type: String, required: true },
    dimensione: { type: Number, required: true },
    descrizione: { type: String, trim: true },
    caricatoDa: { type: String, required: true },
    caricatoDaId: { type: Schema.Types.ObjectId, required: true },
    dataCaricamento: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

allegatoCartellaSchema.index({ workPlan: 1, dataCaricamento: -1 });
allegatoCartellaSchema.index({ patient: 1, dataCaricamento: -1 });

export default model<IAllegatoCartella>('AllegatoCartella', allegatoCartellaSchema);
