import { Document, Schema, model } from 'mongoose';

export interface IProcedureDocument extends Document {
  category: 'procedure' | 'protocol';
  fileName: string;
  contentType: string;
  data: Buffer;
  createdAt: Date;
  updatedAt: Date;
}

const procedureDocumentSchema = new Schema<IProcedureDocument>(
  {
    category: {
      type: String,
      required: true,
      enum: ['procedure', 'protocol']
    },
    fileName: { type: String, required: true, trim: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true }
  },
  { timestamps: true }
);

export default model<IProcedureDocument>('ProcedureDocument', procedureDocumentSchema);
