import { Document, Schema, model, Types } from 'mongoose';

// ═══════════════════════════════════════════════════════════════════════════
// CANDIDATO INTERMEDIAZIONE — iscrizione rapida badanti / colf / assistenti
// familiari dal link pubblico /iscriviti-intermediazione. Tutti i campi
// opzionali tranne nome+cognome: il modulo è volutamente veloce e informale.
// Dopo l'accettazione in Gestione Utenti viene creato un record Staff con
// modalitaAbilitata 'intermediazione' (visibile solo nell'area Intermediazioni
// e nella mappa di assegnazione dedicata). Nessun contratto/firma richiesto.
// ═══════════════════════════════════════════════════════════════════════════

export type RuoloCandidato = 'badante' | 'colf' | 'assistente_familiare' | 'oss' | 'infermiere' | 'medico' | 'fisioterapista';
export type StatoCandidato = 'in_attesa' | 'accettato' | 'rifiutato';

export interface ICandidatoIntermediazione extends Document {
  nome: string;
  cognome: string;
  ruolo: RuoloCandidato;
  albo?: string;                   // ordine/albo professionale (sanitari)
  nazionalita?: string;
  dataNascita?: Date;
  extraUe?: boolean;                  // true = non italiana né europea → serve permesso
  permessoSoggiorno?: string;         // 'valido' | 'in_scadenza' | 'assente' | 'documenti_validi'
  codiceFiscale?: string;
  telefono?: string;
  email?: string;
  regioneResidenza?: string;
  cittaResidenza?: string;
  regioneInteresse?: string;          // regione/città dove vorrebbe lavorare
  cittaInteresse?: string;
  disponibilita?: 'diurno' | 'notturno' | 'h24';
  residenzaPressoFamiglia?: boolean;  // se h24: disponibile a vivere presso la famiglia
  certificato?: boolean;              // lavoratore con certificazione (es. corso OSS)
  esperienze?: string;
  note?: string;
  documentoPath?: string;             // file allegato (foto documento / permesso / PDF)
  documentoNome?: string;
  documentoMime?: string;
  stato: StatoCandidato;
  staffId?: Types.ObjectId;           // Staff creato all'accettazione
  noteAdmin?: string;
  richiesteDati?: { at: Date; campi: string[]; canale: 'email' | 'whatsapp' }[];
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ICandidatoIntermediazione>(
  {
    nome: { type: String, required: true, trim: true },
    cognome: { type: String, required: true, trim: true },
    ruolo: { type: String, enum: ['badante', 'colf', 'assistente_familiare', 'oss', 'infermiere', 'medico', 'fisioterapista'], required: true },
  albo: { type: String, trim: true },
    nazionalita: { type: String, trim: true },
    dataNascita: { type: Date },
    extraUe: { type: Boolean, default: false },
    permessoSoggiorno: { type: String, trim: true },
    codiceFiscale: { type: String, trim: true, uppercase: true },
    telefono: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    regioneResidenza: { type: String, trim: true },
    cittaResidenza: { type: String, trim: true },
    regioneInteresse: { type: String, trim: true },
    cittaInteresse: { type: String, trim: true },
    disponibilita: { type: String, enum: ['diurno', 'notturno', 'h24'] },
    residenzaPressoFamiglia: { type: Boolean, default: false },
    certificato: { type: Boolean, default: false },
    esperienze: { type: String, trim: true },
    note: { type: String, trim: true },
    documentoPath: { type: String },
    documentoNome: { type: String },
    documentoMime: { type: String },
    stato: { type: String, enum: ['in_attesa', 'accettato', 'rifiutato'], default: 'in_attesa', index: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff' },
    noteAdmin: { type: String, trim: true },
    richiesteDati: [{ at: { type: Date, default: Date.now }, campi: [{ type: String }], canale: { type: String, enum: ['email', 'whatsapp'] } }],
  },
  { timestamps: true }
);

schema.index({ stato: 1, createdAt: -1 });

export default model<ICandidatoIntermediazione>('CandidatoIntermediazione', schema);
