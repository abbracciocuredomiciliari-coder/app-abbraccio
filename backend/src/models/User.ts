import { Document, Schema, model } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'coordinator' | 'caregiver';
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['admin', 'coordinator', 'caregiver'], default: 'caregiver' }
  },
  { timestamps: true }
);

export default model<IUser>('User', userSchema);
