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
  tipo: 'preventivo_veloce' | 'costo_badante' | 'contratto_firma';
  canale: 'whatsapp' | 'email';
  contrattoId?: string;               // contratto_firma: riferimento al ContrattoPaziente inviato
  nomeCliente?: string;   // nome/cognome o intestatario libero (nessun paziente)
  email?: string;
  telefono?: string;
  prestazioni: IVoceInviata[];          // preventivo_veloce: righe per rigenerare il PDF
  totale?: number;
  simulazione?: Record<string, any>;    // costo_badante: { input, risultato, cafMensile, escludiTfrTredicesima }
  testoInviato?: string;                // riepilogo testuale del messaggio inviato
  inviatoDa?: string;
  // Ciclo di vita commerciale — ogni invio ha uno stato e, se in lavorazione,
  // una prossima azione datata (ricontatto). Default 'inviato' per i record esistenti.
  stato?: 'inviato' | 'accettato' | 'rifiutato' | 'sostituito';
  esitoNote?: string;                   // perché accettato/rifiutato
  esitoDa?: string;                     // chi ha registrato l'esito
  esitoIl?: Date;
  ricontattoIl?: Date;                  // prossima azione datata
  // Versioni: un invio può sostituire il precedente per lo stesso cliente
  versione?: number;
  gruppoId?: string;                    // collega tutte le versioni della stessa pratica
  sostituitoDaId?: string;              // versione più recente che ha sostituito questa
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
    tipo: { type: String, enum: ['preventivo_veloce', 'costo_badante', 'contratto_firma'], required: true },
    canale: { type: String, enum: ['whatsapp', 'email'], required: true },
    contrattoId: { type: String, trim: true },
    nomeCliente: { type: String, trim: true },
    email: { type: String, trim: true },
    telefono: { type: String, trim: true },
    prestazioni: { type: [voceSchema], default: [] },
    totale: { type: Number },
    simulazione: { type: Schema.Types.Mixed },
    testoInviato: { type: String },
    inviatoDa: { type: String, trim: true },
    stato: { type: String, enum: ['inviato', 'accettato', 'rifiutato', 'sostituito'], default: 'inviato', index: true },
    esitoNote: { type: String, trim: true, maxlength: 1000 },
    esitoDa: { type: String, trim: true },
    esitoIl: { type: Date },
    ricontattoIl: { type: Date, index: true },
    versione: { type: Number, default: 1 },
    gruppoId: { type: String, trim: true, index: true },
    sostituitoDaId: { type: String, trim: true },
  },
  { timestamps: true }
);

schema.index({ area: 1, createdAt: -1 });

export default model<IPreventivoInviato>('PreventivoInviato', schema);
