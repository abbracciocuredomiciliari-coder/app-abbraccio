import { Document, Schema, model, Types } from 'mongoose';

export interface IMedicalEquipment extends Document {
  tipo: string;
  matricola: string;
  controlloEseguito: boolean;
  dataControllo?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const medicalEquipmentSchema = new Schema<IMedicalEquipment>(
  {
    tipo: { type: String, required: true, trim: true },
    matricola: { type: String, required: true, unique: true, trim: true },
    controlloEseguito: { type: Boolean, default: false },
    dataControllo: { type: Date }
  },
  { timestamps: true }
);

export default model<IMedicalEquipment>('MedicalEquipment', medicalEquipmentSchema);