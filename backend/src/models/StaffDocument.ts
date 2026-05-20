import { Document, Schema, model, Types } from 'mongoose';

export interface IStaffDocument extends Document {
  staff: Types.ObjectId;
  documentType?: string;
  title: string;
  description?: string;
  fileName: string;
  contentType: string;
  data: Buffer;
  createdAt: Date;
  updatedAt: Date;
}

const staffDocumentSchema = new Schema<IStaffDocument>(
  {
    staff: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
    documentType: { type: String, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    fileName: { type: String, required: true, trim: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true }
  },
  { timestamps: true }
);

// Index for efficient queries
staffDocumentSchema.index({ staff: 1, createdAt: -1 });

export default model<IStaffDocument>('StaffDocument', staffDocumentSchema);