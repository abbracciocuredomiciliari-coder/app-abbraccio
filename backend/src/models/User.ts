import { Document, Schema, model } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'coordinator' | 'caregiver' | 'direttore';
  status: 'pending' | 'approved' | 'rejected';
  professione?: string;
  categoria?: string;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'coordinator', 'caregiver', 'direttore'],
      default: 'caregiver'
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    professione: { type: String, trim: true },
    categoria: { type: String, trim: true },
  },
  { timestamps: true }
);

export default model<IUser>('User', userSchema);
