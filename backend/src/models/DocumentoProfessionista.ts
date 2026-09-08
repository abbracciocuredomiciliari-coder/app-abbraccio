import { Document, Schema, model, Types } from 'mongoose';

export type TipoDocumentoProfessionista = 'ritenuta_acconto' | 'ricevuta' | 'fattura_ricevuta';

export interface IDocumentoProfessionista extends Document {
  ritenutaAccontoId: Types.ObjectId;
  tipo: TipoDocumentoProfessionista;
  numero: string;
  data: Date;
  professionistaId?: Types.ObjectId;
  datiProfessionista: {
    firstName?: string;
    lastName?: string;
    codiceFiscale?: string;
    partitaIva?: string;
    indirizzo?: string;
    citta?: string;
  };
  descrizione?: string;
  importoLordo: number;
  importoRitenuta: number;
  importoBollo: number;
  nettoAPagare: number;
  fileName: string;
  contentType: string;
  contenuto: Buffer;
  creatoDa?: string;
}

const documentoProfessionistaSchema = new Schema<IDocumentoProfessionista>(
  {
    ritenutaAccontoId: { type: Schema.Types.ObjectId, ref: 'RitenutaAcconto', required: true, index: true },
    tipo: { type: String, enum: ['ritenuta_acconto', 'ricevuta', 'fattura_ricevuta'], required: true },
    numero: { type: String, required: true },
    data: { type: Date, required: true, default: Date.now },
    professionistaId: { type: Schema.Types.ObjectId, ref: 'Staff' },
    datiProfessionista: {
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      codiceFiscale: { type: String, trim: true },
      partitaIva: { type: String, trim: true },
      indirizzo: { type: String, trim: true },
      citta: { type: String, trim: true },
    },
    descrizione: { type: String, trim: true },
    importoLordo: { type: Number, required: true, default: 0 },
    importoRitenuta: { type: Number, required: true, default: 0 },
    importoBollo: { type: Number, required: true, default: 0 },
    nettoAPagare: { type: Number, required: true, default: 0 },
    fileName: { type: String, required: true },
    contentType: { type: String, required: true, default: 'application/pdf' },
    contenuto: { type: Buffer, required: true },
    creatoDa: { type: String, trim: true },
  },
  { timestamps: true }
);

documentoProfessionistaSchema.index({ ritenutaAccontoId: 1, tipo: 1 });
documentoProfessionistaSchema.index({ data: -1 });

export default model<IDocumentoProfessionista>('DocumentoProfessionista', documentoProfessionistaSchema);
