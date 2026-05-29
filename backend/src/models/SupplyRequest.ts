import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplyRequestItem {
  supplyId: string;
  nome: string;
  categoria: 'presidio' | 'farmaco';
  unitaMisura?: string;
  quantitaRichiesta: number;
  quantitaAutorizzata?: number;
  statoItem: 'in_attesa' | 'autorizzato' | 'rifiutato' | 'parziale';
  noteAdmin?: string;
}

export interface ISupplyRequest extends Document {
  operatoreId: mongoose.Types.ObjectId;
  operatoreNome: string;
  stato: 'in_attesa' | 'gestita' | 'rifiutata' | 'consegnata';
  noteOperatore?: string;
  noteAdmin?: string;
  items: ISupplyRequestItem[];
  dataRichiesta: Date;
  dataGestione?: Date;
  gestitaDa?: string;
  dataConsegna?: Date;
  consegnataDa?: string;
}

const SupplyRequestItemSchema = new Schema<ISupplyRequestItem>({
  supplyId: { type: String, required: true },
  nome: { type: String, required: true },
  categoria: { type: String, enum: ['presidio', 'farmaco'], required: true },
  unitaMisura: { type: String },
  quantitaRichiesta: { type: Number, required: true, min: 1 },
  quantitaAutorizzata: { type: Number },
  statoItem: { type: String, enum: ['in_attesa', 'autorizzato', 'rifiutato', 'parziale'], default: 'in_attesa' },
  noteAdmin: { type: String },
}, { _id: false });

const SupplyRequestSchema = new Schema<ISupplyRequest>({
  operatoreId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
  operatoreNome: { type: String, required: true },
  stato: { type: String, enum: ['in_attesa', 'gestita', 'rifiutata', 'consegnata'], default: 'in_attesa' },
  noteOperatore: { type: String },
  noteAdmin: { type: String },
  items: [SupplyRequestItemSchema],
  dataRichiesta: { type: Date, default: Date.now },
  dataGestione: { type: Date },
  gestitaDa: { type: String },
  dataConsegna: { type: Date },
  consegnataDa: { type: String },
}, { timestamps: true });

export default mongoose.model<ISupplyRequest>('SupplyRequest', SupplyRequestSchema);
