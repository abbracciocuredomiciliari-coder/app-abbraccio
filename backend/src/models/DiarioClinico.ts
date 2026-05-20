import { Document, Schema, model, Types } from 'mongoose';

export interface IParametriVitali {
  pressioneSistolica?: number;
  pressioneDiastolica?: number;
  frequenzaCardiaca?: number;
  frequenzaRespiratoria?: number;
  temperatura?: number;
  saturazione?: number;
  glicemia?: number;
  peso?: number;
  dolore?: number; // scala 0-10
}

export interface IDiarioClinico extends Document {
  workPlan: Types.ObjectId;
  workPlanAccess?: Types.ObjectId;
  patient: Types.ObjectId;
  staff: Types.ObjectId;
  staffName: string;
  dataRegistrazione: Date;
  testo: string;
  parametriVitali?: IParametriVitali;
  firmaLogin: string;
  firmato: boolean;       // una volta firmato non è più modificabile
  dataFirma?: Date;
}

const parametriVitaliSchema = new Schema<IParametriVitali>({
  pressioneSistolica: { type: Number },
  pressioneDiastolica: { type: Number },
  frequenzaCardiaca: { type: Number },
  frequenzaRespiratoria: { type: Number },
  temperatura: { type: Number },
  saturazione: { type: Number },
  glicemia: { type: Number },
  peso: { type: Number },
  dolore: { type: Number, min: 0, max: 10 },
}, { _id: false });

const diarioClinicoSchema = new Schema<IDiarioClinico>(
  {
    workPlan: { type: Schema.Types.ObjectId, ref: 'WorkPlan', required: true },
    workPlanAccess: { type: Schema.Types.ObjectId, ref: 'WorkPlanAccess' },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    staff: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
    staffName: { type: String, required: true },
    dataRegistrazione: { type: Date, required: true, default: Date.now },
    testo: { type: String, required: true, trim: true },
    parametriVitali: { type: parametriVitaliSchema },
    firmaLogin: { type: String, required: true },
    firmato: { type: Boolean, default: false },
    dataFirma: { type: Date },
  },
  { timestamps: true }
);

diarioClinicoSchema.index({ patient: 1, dataRegistrazione: -1 });
diarioClinicoSchema.index({ workPlan: 1, dataRegistrazione: -1 });

export default model<IDiarioClinico>('DiarioClinico', diarioClinicoSchema);
