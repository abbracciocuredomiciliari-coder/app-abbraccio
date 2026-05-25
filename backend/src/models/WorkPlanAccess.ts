import { Document, Schema, model, Types } from 'mongoose';

export interface IWorkPlanAccess extends Document {
  workPlan: Types.ObjectId;
  staffId: Types.ObjectId;
  staffName: string;
  staffRole: string;
  oraEntrata: Date;
  oraUscita?: Date;
  note?: string;
  firmaLogin: string; // nome utente che ha firmato
  ipAddress?: string;
  durataMinuti?: number;       // durata in minuti (calcolata all'uscita)
  compensoMaturato?: number;   // compenso guadagnato per questo singolo accesso
}

const workPlanAccessSchema = new Schema<IWorkPlanAccess>(
  {
    workPlan: { type: Schema.Types.ObjectId, ref: 'WorkPlan', required: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
    staffName: { type: String, required: true },
    staffRole: { type: String, required: true },
    oraEntrata: { type: Date, required: true },
    oraUscita: { type: Date },
    note: { type: String, trim: true },
    firmaLogin: { type: String, required: true },
    ipAddress: { type: String },
    durataMinuti: { type: Number, default: 0 },
    compensoMaturato: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default model<IWorkPlanAccess>('WorkPlanAccess', workPlanAccessSchema);
