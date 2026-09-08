import { Document, Schema, model, Types } from 'mongoose';

export interface IDatiProfessionista {
  firstName: string;
  lastName: string;
  codiceFiscale?: string;
  partitaIva?: string;
  indirizzo?: string;
  citta?: string;
  email?: string;
}

export interface IRitenutaAcconto extends Document {
  numero: string;
  data: Date;
  professionistaId?: Types.ObjectId;
  datiProfessionista: IDatiProfessionista;
  descrizione?: string;
  importoLordo: number;
  percentualeRitenuta: number;
  importoRitenuta: number;
  importoBollo: number;
  nettoAPagare: number;
  numeroDocumentoProfessionista?: string;
  stato: 'emesso' | 'firmato' | 'annullato';
  firma?: {
    token?: string;
    firmato: boolean;
    firmatoIl?: Date;
    firmaImg?: string;
    nome?: string;
    email?: string;
  };
}

const datiProfessionistaSchema = new Schema<IDatiProfessionista>(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    codiceFiscale: { type: String, trim: true },
    partitaIva: { type: String, trim: true },
    indirizzo: { type: String, trim: true },
    citta: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { _id: false }
);

const ritenutaAccontoSchema = new Schema<IRitenutaAcconto>(
  {
    numero: { type: String, required: true, unique: true },
    data: { type: Date, required: true, default: Date.now },
    professionistaId: { type: Schema.Types.ObjectId, ref: 'Staff', index: true },
    datiProfessionista: { type: datiProfessionistaSchema, required: true },
    descrizione: { type: String, trim: true },
    importoLordo: { type: Number, required: true, default: 0 },
    percentualeRitenuta: { type: Number, required: true, default: 20 },
    importoRitenuta: { type: Number, required: true, default: 0 },
    importoBollo: { type: Number, required: true, default: 0 },
    nettoAPagare: { type: Number, required: true, default: 0 },
    numeroDocumentoProfessionista: { type: String, trim: true },
    stato: { type: String, enum: ['emesso', 'firmato', 'annullato'], default: 'emesso' },
    firma: {
      token: { type: String, unique: true, sparse: true },
      firmato: { type: Boolean, default: false },
      firmatoIl: { type: Date },
      firmaImg: { type: String },
      nome: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
  },
  { timestamps: true }
);

ritenutaAccontoSchema.index({ professionistaId: 1, data: -1 });
ritenutaAccontoSchema.index({ stato: 1, data: -1 });

export default model<IRitenutaAcconto>('RitenutaAcconto', ritenutaAccontoSchema);
