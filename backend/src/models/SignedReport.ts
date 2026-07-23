import { Schema, model, Types, Document } from 'mongoose';

export interface ISignedReport extends Document {
  patient: Types.ObjectId;
  staff: Types.ObjectId;
  staffName: string;
  reportText: string;
  signatureBase64: string;
  scope: 'all' | 'category';
  category?: string;
  workPlanType?: string;
  fromDate?: Date;
  toDate?: Date;
  createdAt: Date;
}

const signedReportSchema = new Schema<ISignedReport>(
  {
    patient: { type: Schema.Types.ObjectId, required: true, ref: 'Patient', index: true },
    staff: { type: Schema.Types.ObjectId, required: true, ref: 'Staff' },
    staffName: { type: String, required: true },
    reportText: { type: String, required: true },
    signatureBase64: { type: String, required: true },
    scope: { type: String, enum: ['all', 'category'], default: 'all' },
    category: { type: String },
    workPlanType: { type: String },
    fromDate: { type: Date },
    toDate: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

signedReportSchema.index({ patient: 1, createdAt: -1 });
signedReportSchema.index({ staff: 1, createdAt: -1 });

export default model<ISignedReport>('SignedReport', signedReportSchema);
