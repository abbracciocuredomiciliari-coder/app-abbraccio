import { Document, Schema, model } from 'mongoose';

export interface IPatient extends Document {
  firstName: string;
  lastName: string;
  birthDate: Date;
  address: string;
  assistanceNeeds: string;
  contactPhone?: string;
  email?: string;
  codiceFiscale?: string;
  
  // === MODALITÀ GESTIONE ===
  tipoGestione: 'privato' | 'convenzione';  // default: privato
  
  // === ALERT PAI IN SCADENZA ===
  alertPaiVisto?: {
    vistoIl: Date;
    vistoDa: string;      // nome utente
    vistoDaId: string;    // userId
  };

  // === DATI CONVENZIONE SIAT LAZIO ===
  siat?: {
    npi?: string;                // Numero Progressivo Intervento SIAT
    codiceAutorizzazione?: string; // Codice autorizzazione Regione Lazio
    codicePrestazione?: string;   // Codice prestazione ADI/SAD
    tipologiaCura?: string;       // Es: ADI 1°livello, SAD, ecc.
    dataAutorizzazione?: Date;
    dataScadenzaAutorizzazione?: Date;
    distretto?: string;           // Distretto ASL di riferimento
    asl?: string;                 // ASL di competenza
    uvm?: string;                 // Unità di Valutazione Multidimensionale
    medicoReferente?: string;
    importatoDa?: string;         // Nome file CSV origine
    importatoIl?: Date;
    note?: string;
  };
}

const patientSchema = new Schema<IPatient>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    birthDate: { type: Date, required: true },
    address: { type: String, required: true, trim: true },
    assistanceNeeds: { type: String, required: true, trim: true },
    contactPhone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    codiceFiscale: { type: String, trim: true, uppercase: true },
    tipoGestione: { type: String, enum: ['privato', 'convenzione'], default: 'privato' },
    alertPaiVisto: {
      vistoIl: { type: Date },
      vistoDa: { type: String },
      vistoDaId: { type: String },
    },
    siat: {
      npi: { type: String, trim: true },
      codiceAutorizzazione: { type: String, trim: true },
      codicePrestazione: { type: String, trim: true },
      tipologiaCura: { type: String, trim: true },
      dataAutorizzazione: { type: Date },
      dataScadenzaAutorizzazione: { type: Date },
      distretto: { type: String, trim: true },
      asl: { type: String, trim: true },
      uvm: { type: String, trim: true },
      medicoReferente: { type: String, trim: true },
      importatoDa: { type: String },
      importatoIl: { type: Date },
      note: { type: String },
    },
  },
  { timestamps: true }
);

patientSchema.index({ tipoGestione: 1, lastName: 1 });

export default model<IPatient>('Patient', patientSchema);
