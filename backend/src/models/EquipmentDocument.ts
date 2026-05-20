import { Document, Schema, model, Types } from 'mongoose';

export type DocumentType = 'conformita' | 'manutenzione' | 'manuale';

export interface IEquipmentDocument extends Document {
  equipment: Types.ObjectId;
  documentType: DocumentType;
  fileName: string;
  contentType: string;
  data: Buffer;
  uploadedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const equipmentDocumentSchema = new Schema<IEquipmentDocument>(
  {
    equipment: { type: Schema.Types.ObjectId, ref: 'MedicalEquipment', required: true },
    documentType: { 
      type: String, 
      required: true, 
      enum: ['conformita', 'manutenzione', 'manuale'] 
    },
    fileName: { type: String, required: true, trim: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

// Index to ensure one document per type per equipment
equipmentDocumentSchema.index({ equipment: 1, documentType: 1 }, { unique: true });

export default model<IEquipmentDocument>('EquipmentDocument', equipmentDocumentSchema);