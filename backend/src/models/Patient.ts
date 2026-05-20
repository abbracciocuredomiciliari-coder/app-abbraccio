import { Document, Schema, model } from 'mongoose';

export interface IPatient extends Document {
  firstName: string;
  lastName: string;
  birthDate: Date;
  address: string;
  assistanceNeeds: string;
  contactPhone?: string;
}

const patientSchema = new Schema<IPatient>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    birthDate: { type: Date, required: true },
    address: { type: String, required: true, trim: true },
    assistanceNeeds: { type: String, required: true, trim: true },
    contactPhone: { type: String, trim: true }
  },
  { timestamps: true }
);

export default model<IPatient>('Patient', patientSchema);
