import { Schema, model, Document } from 'mongoose';

export interface IShopAdmin extends Document {
  email: string;
  passwordHash: string;
  nome: string;
}

const shopAdminSchema = new Schema<IShopAdmin>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    nome: { type: String, default: 'Shop Admin' },
  },
  { timestamps: true }
);

export default model<IShopAdmin>('ShopAdmin', shopAdminSchema);
