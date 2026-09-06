import { Document, Schema, model, Types } from 'mongoose';

export interface IContrattoPaziente extends Document {
  patient: Types.ObjectId;
  profilo: 'OSS' | 'Infermiere';
  importo: number;
  data: Date;
  stato: 'emesso' | 'firmato';
  token: string;
  email?: string;
  nome?: string;
  luogoFirma?: string;
  dataFirma?: Date;
  firmaImg?: string;
  htmlFirmato?: string;
}

const contrattoPazienteSchema = new Schema<IContrattoPaziente>(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    profilo: { type: String, enum: ['OSS', 'Infermiere'], required: true },
    importo: { type: Number, required: true, default: 150 },
    data: { type: Date, default: Date.now },
    stato: { type: String, enum: ['emesso', 'firmato'], default: 'emesso' },
    token: { type: String, unique: true, sparse: true },
    email: { type: String, trim: true, lowercase: true },
    nome: { type: String, trim: true },
    luogoFirma: { type: String, trim: true },
    dataFirma: { type: Date },
    firmaImg: { type: String },
    htmlFirmato: { type: String },
  },
  { timestamps: true }
);

contrattoPazienteSchema.index({ patient: 1, data: -1 });
contrattoPazienteSchema.index({ token: 1 });

export default model<IContrattoPaziente>('ContrattoPaziente', contrattoPazienteSchema);
