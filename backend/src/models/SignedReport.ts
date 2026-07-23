import { Schema, model, Types, Document } from 'mongoose';

export interface ISignedReport extends Document {
  patient: Types.ObjectId;
  staff: Types.ObjectId;
  staffName: string;
  reportText: string;
  signatureBase64: string;
  createdAt: Date;
}

const signedReportSchema = new Schema<ISignedReport>(
  {
    patient: { type: Schema.Types.ObjectId, required: true, ref: 'Patient', index: true },
    staff: { type: Schema.Types.ObjectId, required: true, ref: 'Staff' },
    staffName: { type: String, required: true },
    reportText: { type: String, required: true },
    signatureBase64: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default model<ISignedReport>('SignedReport', signedReportSchema);
