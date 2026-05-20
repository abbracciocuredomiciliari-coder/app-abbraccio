import { Document, Schema, model, Types } from 'mongoose';

export type DocumentCategory = 'cartella_clinica' | 'esame' | 'risultato_analisi' | 'consulenza';

export interface IPatientDocument extends Document {
  patient: Types.ObjectId;
  category: DocumentCategory;
  title: string;
  description?: string;
  fileName: string;
  contentType: string;
  data: Buffer;
  uploadedBy?: Types.ObjectId;
  uploadedByNome?: string;
  dataCaricamento: Date;
  createdAt: Date;
  updatedAt: Date;
}

const patientDocumentSchema = new Schema<IPatientDocument>(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    category: { 
      type: String, 
      required: true, 
      enum: ['cartella_clinica', 'esame', 'risultato_analisi', 'consulenza'] 
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    fileName: { type: String, required: true, trim: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedByNome: { type: String, trim: true },
    dataCaricamento: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Index for efficient queries
patientDocumentSchema.index({ patient: 1, category: 1, createdAt: -1 });

export default model<IPatientDocument>('PatientDocument', patientDocumentSchema);