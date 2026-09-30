import { Schema, model, Document, Types } from 'mongoose';

export interface IShopReview extends Document {
  product: Types.ObjectId;
  nome: string;
  rating: number; // 1-5
  testo: string;
  approvato: boolean;
}

const shopReviewSchema = new Schema<IShopReview>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'ShopProduct', required: true, index: true },
    nome: { type: String, required: true, trim: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    testo: { type: String, default: '', trim: true },
    approvato: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default model<IShopReview>('ShopReview', shopReviewSchema);
