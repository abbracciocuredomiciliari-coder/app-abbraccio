import { Schema, model, Document } from 'mongoose';

export interface IFormazioneSanitaria extends Document {
  patientId: string;
  workPlanId?: string;
  tipoScheda: 'formazione_educazione' | 'valutazione_formazione';
  personaFormata: string;
  ruoloPersonaFormata: 'paziente' | 'caregiver' | 'familiare' | 'altro';
  argomento: string;
  relazione: string;
  dataIntervento: Date;
  firmaOperatore: string;
  operatoreId: string;
  operatoreNome: string;
  createdAt: Date;
  updatedAt: Date;
}

const formazioneSanitariaSchema = new Schema<IFormazioneSanitaria>({
  patientId: { type: String, required: true, index: true },
  workPlanId: { type: String },
  tipoScheda: { type: String, enum: ['formazione_educazione', 'valutazione_formazione'], required: true },
  personaFormata: { type: String, required: true, trim: true },
  ruoloPersonaFormata: { type: String, enum: ['paziente', 'caregiver', 'familiare', 'altro'], required: true },
  argomento: { type: String, required: true, trim: true },
  relazione: { type: String, required: true, trim: true },
  dataIntervento: { type: Date, required: true },
  firmaOperatore: { type: String, required: true },
  operatoreId: { type: String, required: true },
  operatoreNome: { type: String, required: true },
}, { timestamps: true });

formazioneSanitariaSchema.index({ patientId: 1, dataIntervento: -1 });
export default model<IFormazioneSanitaria>('FormazioneSanitaria', formazioneSanitariaSchema);
