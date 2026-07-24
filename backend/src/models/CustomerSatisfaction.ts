import { Document, Schema, model } from 'mongoose';

export interface ICustomerSatisfaction extends Document {
  patientId: string;
  firmatarioTipo: 'paziente' | 'caregiver';
  nomeFirmatario: string;
  cognomeFirmatario: string;
  risposte: {
    cortesiaProfessionalita: number;
    puntualitaOrganizzazione: number;
    chiarezzaInformazioni: number;
    qualitaAssistenza: number;
    soddisfazioneComplessiva: number;
  };
  suggerimenti?: string;
  firmaFirmatario: string;
  firmaCoordinatore: string;
  coordinatoreId: string;
  coordinatoreNome: string;
  dataCompilazione: Date;
  createdAt: Date;
  updatedAt: Date;
}

const customerSatisfactionSchema = new Schema<ICustomerSatisfaction>({
  patientId: { type: String, required: true, index: true },
  firmatarioTipo: { type: String, enum: ['paziente', 'caregiver'], required: true },
  nomeFirmatario: { type: String, required: true, trim: true },
  cognomeFirmatario: { type: String, required: true, trim: true },
  risposte: {
    cortesiaProfessionalita: { type: Number, required: true, min: 1, max: 5 },
    puntualitaOrganizzazione: { type: Number, required: true, min: 1, max: 5 },
    chiarezzaInformazioni: { type: Number, required: true, min: 1, max: 5 },
    qualitaAssistenza: { type: Number, required: true, min: 1, max: 5 },
    soddisfazioneComplessiva: { type: Number, required: true, min: 1, max: 5 },
  },
  suggerimenti: { type: String, trim: true },
  firmaFirmatario: { type: String, required: true },
  firmaCoordinatore: { type: String, required: true },
  coordinatoreId: { type: String, required: true },
  coordinatoreNome: { type: String, required: true },
  dataCompilazione: { type: Date, default: Date.now },
}, { timestamps: true });

customerSatisfactionSchema.index({ patientId: 1, dataCompilazione: -1 });

export default model<ICustomerSatisfaction>('CustomerSatisfaction', customerSatisfactionSchema);
