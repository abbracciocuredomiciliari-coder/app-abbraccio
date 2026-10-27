import { Document, Schema, model } from 'mongoose';

// ═════════════════════════════════════════════════════════════════════════════
// PREVENTIVO INVIATO — archivio dei preventivi/costi inviati via WhatsApp o
// email SENZA aver creato il paziente (preventivo veloce da Gestione Privata,
// costo badante dal simulatore Intermediazioni). Serve a ritrovare cosa è
// stato mandato al cliente se poi accetta: il PDF si rigenera dai dati salvati.
// ═════════════════════════════════════════════════════════════════════════════

export interface IVoceInviata {
  descrizione: string;
  quantita: number;
  prezzoUnitario: number;
  importo: number;
  tipo?: string;
  aliquotaIva?: number;
}

export interface IPreventivoInviato extends Document {
  area: 'privato' | 'intermediazione';
  tipo: 'preventivo_veloce' | 'costo_badante';
  canale: 'whatsapp' | 'email';
  nomeCliente?: string;   // nome/cognome o intestatario libero (nessun paziente)
  email?: string;
  telefono?: string;
  prestazioni: IVoceInviata[];          // preventivo_veloce: righe per rigenerare il PDF
  totale?: number;
  simulazione?: Record<string, any>;    // costo_badante: { input, risultato, cafMensile, escludiTfrTredicesima }
  testoInviato?: string;                // riepilogo testuale del messaggio inviato
  inviatoDa?: string;
  createdAt: Date;
  updatedAt: Date;
}

const voceSchema = new Schema<IVoceInviata>(
  {
    descrizione: { type: String, required: true, trim: true },
    quantita: { type: Number, default: 1 },
    prezzoUnitario: { type: Number, default: 0 },
    importo: { type: Number, default: 0 },
    tipo: { type: String, trim: true },
    aliquotaIva: { type: Number, default: 0 },
  },
  { _id: false }
);

const schema = new Schema<IPreventivoInviato>(
  {
    area: { type: String, enum: ['privato', 'intermediazione'], required: true, index: true },
    tipo: { type: String, enum: ['preventivo_veloce', 'costo_badante'], required: true },
    canale: { type: String, enum: ['whatsapp', 'email'], required: true },
    nomeCliente: { type: String, trim: true },
    email: { type: String, trim: true },
    telefono: { type: String, trim: true },
    prestazioni: { type: [voceSchema], default: [] },
    totale: { type: Number },
    simulazione: { type: Schema.Types.Mixed },
    testoInviato: { type: String },
    inviatoDa: { type: String, trim: true },
  },
  { timestamps: true }
);

schema.index({ area: 1, createdAt: -1 });

export default model<IPreventivoInviato>('PreventivoInviato', schema);
