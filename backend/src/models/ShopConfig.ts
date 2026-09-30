import { Schema, model, Document } from 'mongoose';

export interface IShopConfig extends Document {
  paypalLink: string; // es. https://paypal.me/AbbraccioCure
  iban?: string;
  noteCheckout?: string;
  offerte: string[]; // messaggi ticker scorrevole offerte
  telefonoAssistenza?: string;
  whatsappAssistenza?: string;
  emailAssistenza?: string;
}

const shopConfigSchema = new Schema<IShopConfig>(
  {
    paypalLink: { type: String, default: '', trim: true },
    iban: { type: String, default: '', trim: true },
    noteCheckout: { type: String, default: '', trim: true },
    offerte: [{ type: String, trim: true }],
    telefonoAssistenza: { type: String, default: '', trim: true },
    whatsappAssistenza: { type: String, default: '', trim: true },
    emailAssistenza: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

export default model<IShopConfig>('ShopConfig', shopConfigSchema);
