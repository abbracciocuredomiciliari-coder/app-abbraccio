import { Document, Schema, model, Types } from 'mongoose';

export type MovementType = 'carico' | 'scarico';

export interface ISupplyMovement extends Document {
  supply: Types.ObjectId;
  tipo: MovementType;
  quantita: number;
  motivazione?: string;
  eseguitoDa?: Types.ObjectId;
  eseguitoDaNome?: string;
  dataMovimento: Date;
  quantitaPrecedente: number;
  quantitaSuccessiva: number;
  createdAt: Date;
}

const supplyMovementSchema = new Schema<ISupplyMovement>(
  {
    supply: { type: Schema.Types.ObjectId, ref: 'MedicalSupply', required: true },
    tipo: { type: String, required: true, enum: ['carico', 'scarico'] },
    quantita: { type: Number, required: true, min: 1 },
    motivazione: { type: String, trim: true },
    eseguitoDa: { type: Schema.Types.ObjectId, ref: 'User' },
    eseguitoDaNome: { type: String, trim: true },
    dataMovimento: { type: Date, default: Date.now },
    quantitaPrecedente: { type: Number, required: true },
    quantitaSuccessiva: { type: Number, required: true }
  },
  { timestamps: true }
);

// Index for efficient queries
supplyMovementSchema.index({ supply: 1, dataMovimento: -1 });

export default model<ISupplyMovement>('SupplyMovement', supplyMovementSchema);