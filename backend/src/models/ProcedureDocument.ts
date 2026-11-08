import { Document, Schema, model } from 'mongoose';

export interface IProcedureDocument extends Document {
  category: 'procedure' | 'protocol' | 'modulistica';
  fileName: string;
  displayName?: string;
  contentType: string;
  data: Buffer;
  // Catalogo versionato: ogni documento ha versione e stato di vigore
  versione?: number;
  stato?: 'bozza' | 'vigente' | 'archiviata';
  autoreNome?: string;
  noteVersione?: string;
  createdAt: Date;
  updatedAt: Date;
}

const procedureDocumentSchema = new Schema<IProcedureDocument>(
  {
    category: {
      type: String,
      required: true,
      enum: ['procedure', 'protocol', 'modulistica']
    },
    fileName: { type: String, required: true, trim: true },
    displayName: { type: String, trim: true, default: '' },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
    versione: { type: Number, default: 1 },
    stato: { type: String, enum: ['bozza', 'vigente', 'archiviata'], default: 'vigente' },
    autoreNome: { type: String, trim: true },
    noteVersione: { type: String, trim: true }
  },
  { timestamps: true }
);

export default model<IProcedureDocument>('ProcedureDocument', procedureDocumentSchema);
