import { Schema, model, Document } from 'mongoose';

export type ShopCategoria = 'vendita' | 'noleggio' | 'apnea';

export interface IShopProduct extends Document {
  nome: string;
  descrizione: string;
  categoria: ShopCategoria;
  prezzo?: number; // vendita / esame apnea
  prezzoNoleggio?: { giorno?: number; settimana?: number; mese?: number };
  cauzione?: number;
  immagini: string[]; // URL /shop-images/<file>
  disponibile: boolean;
  attivo: boolean;
  ordine: number;
}

const shopProductSchema = new Schema<IShopProduct>(
  {
    nome: { type: String, required: true, trim: true },
    descrizione: { type: String, default: '', trim: true },
    categoria: { type: String, enum: ['vendita', 'noleggio', 'apnea'], required: true },
    prezzo: { type: Number, default: 0 },
    prezzoNoleggio: {
      giorno: { type: Number, default: 0 },
      settimana: { type: Number, default: 0 },
      mese: { type: Number, default: 0 },
    },
    cauzione: { type: Number, default: 0 },
    immagini: [{ type: String }],
    disponibile: { type: Boolean, default: true },
    attivo: { type: Boolean, default: true },
    ordine: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default model<IShopProduct>('ShopProduct', shopProductSchema);
