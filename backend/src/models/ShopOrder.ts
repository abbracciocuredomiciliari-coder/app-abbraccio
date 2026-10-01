import { Schema, model, Document } from 'mongoose';

export interface IShopOrderItem {
  product?: string;
  nome: string;
  prezzo: number;
  qty: number;
  tariffa?: string; // noleggio: 'giorno' | 'settimana' | 'mese'
}

export interface IShopOrder extends Document {
  tipo: 'acquisto' | 'noleggio' | 'apnea';
  metodoPagamento?: 'paypal' | 'carta' | 'bonifico';
  items: IShopOrderItem[];
  cliente: {
    nome: string;
    email: string;
    telefono: string;
    indirizzo?: string;
    note?: string;
  };
  periodo?: { da?: Date; a?: Date };
  totale: number;
  stato: 'nuovo' | 'confermato' | 'pagato' | 'evaso' | 'annullato';
  noteAdmin?: string;
}

const shopOrderSchema = new Schema<IShopOrder>(
  {
    tipo: { type: String, enum: ['acquisto', 'noleggio', 'apnea'], required: true },
    metodoPagamento: { type: String, enum: ['paypal', 'carta', 'bonifico'], default: null },
    items: [
      {
        product: { type: Schema.Types.ObjectId, ref: 'ShopProduct' },
        nome: { type: String, required: true },
        prezzo: { type: Number, default: 0 },
        qty: { type: Number, default: 1 },
        tariffa: { type: String, default: '' },
      },
    ],
    cliente: {
      nome: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      telefono: { type: String, required: true, trim: true },
      indirizzo: { type: String, trim: true },
      note: { type: String, trim: true },
    },
    periodo: {
      da: { type: Date },
      a: { type: Date },
    },
    totale: { type: Number, default: 0 },
    stato: {
      type: String,
      enum: ['nuovo', 'confermato', 'pagato', 'evaso', 'annullato'],
      default: 'nuovo',
    },
    noteAdmin: { type: String, trim: true },
  },
  { timestamps: true }
);

shopOrderSchema.index({ stato: 1, createdAt: -1 });

export default model<IShopOrder>('ShopOrder', shopOrderSchema);
