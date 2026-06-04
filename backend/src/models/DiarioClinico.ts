import { Document, Schema, model, Types } from 'mongoose';

export interface IParametriVitali {
  pressioneSistolica?: number;
  pressioneDiastolica?: number;
  frequenzaCardiaca?: number;
  frequenzaRespiratoria?: number;
  temperatura?: number;
  saturazione?: number;
  glicemia?: number;
  peso?: number;
  dolore?: number; // scala 0-10
}

export interface IDiarioClinico extends Document {
  workPlan: Types.ObjectId;
  workPlanAccess?: Types.ObjectId;
  patient: Types.ObjectId;
  staff: Types.ObjectId;
  staffName: string;
  dataRegistrazione: Date;
  testo: string;
  parametriVitali?: IParametriVitali;
  firmaLogin: string;              // Firma semplice (email/username) - per audit interno
  firmato: boolean;                // una volta firmato non è più modificabile
  dataFirma?: Date;
  
  // === MARCATURA TEMPORALE (RFC 3161) ===
  documentHash?: string;           // SHA-256 del documento serializzato
  timestamp?: {
    timestamp: Date;               // Data/ora della marcatura
    timestampToken: string;        // Token TSA (Base64)
    serialNumber: string;          // Numero seriale marca
    tsaName: string;               // Nome TSA (es. INFOCERT_DEMO)
    hashAlgorithm: string;         // Algoritmo hash (SHA-256)
    hashValue: string;             // Hash marcato
  };
  
  // === FIRMA DIGITALE AVANZATA (preparazione per futuro) ===
  firmaDigitale?: {
    tipo: 'FEA' | 'FES' | 'FEQ';   // Firma Elettronica Avanzata/Semplice/Qualificata
    provider?: string;             // Provider firma (Infocert, Aruba, etc.)
    hashToSign?: string;           // Hash del documento+timestamp da firmare
    signatureValue?: string;       // Valore firma (Base64) - popolato quando firmato
    certificateSN?: string;        // Serial number certificato
    certificateIssuer?: string;    // DN emittente certificato
    signedAt?: Date;               // Data firma
    validFrom?: Date;              // Inizio validità certificato
    validTo?: Date;                // Scadenza certificato
    verificationStatus?: 'valid' | 'expired' | 'revoked' | 'error';
  };
}

const parametriVitaliSchema = new Schema<IParametriVitali>({
  pressioneSistolica: { type: Number },
  pressioneDiastolica: { type: Number },
  frequenzaCardiaca: { type: Number },
  frequenzaRespiratoria: { type: Number },
  temperatura: { type: Number },
  saturazione: { type: Number },
  glicemia: { type: Number },
  peso: { type: Number },
  dolore: { type: Number, min: 0, max: 10 },
}, { _id: false });

// Schema per timestamp RFC 3161
const timestampSchema = new Schema({
  timestamp: { type: Date, required: true },
  timestampToken: { type: String, required: true },
  serialNumber: { type: String, required: true },
  tsaName: { type: String, required: true },
  hashAlgorithm: { type: String, default: 'SHA-256' },
  hashValue: { type: String, required: true },
}, { _id: false });

// Schema per firma digitale
const firmaDigitaleSchema = new Schema({
  tipo: { type: String, enum: ['FEA', 'FES', 'FEQ'], default: 'FEA' },
  provider: { type: String },
  hashToSign: { type: String },
  signatureValue: { type: String },
  certificateSN: { type: String },
  certificateIssuer: { type: String },
  signedAt: { type: Date },
  validFrom: { type: Date },
  validTo: { type: Date },
  verificationStatus: { type: String, enum: ['valid', 'expired', 'revoked', 'error'] },
}, { _id: false });

const diarioClinicoSchema = new Schema<IDiarioClinico>(
  {
    workPlan: { type: Schema.Types.ObjectId, ref: 'WorkPlan', required: true },
    workPlanAccess: { type: Schema.Types.ObjectId, ref: 'WorkPlanAccess' },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    staff: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
    staffName: { type: String, required: true },
    dataRegistrazione: { type: Date, required: true, default: Date.now },
    testo: { type: String, required: true, trim: true },
    parametriVitali: { type: parametriVitaliSchema },
    firmaLogin: { type: String, required: true },
    firmato: { type: Boolean, default: false },
    dataFirma: { type: Date },
    
    // Marcatura temporale e firma digitale
    documentHash: { type: String },
    timestamp: { type: timestampSchema },
    firmaDigitale: { type: firmaDigitaleSchema },
  },
  { timestamps: true }
);

diarioClinicoSchema.index({ patient: 1, dataRegistrazione: -1 });
diarioClinicoSchema.index({ workPlan: 1, dataRegistrazione: -1 });

export default model<IDiarioClinico>('DiarioClinico', diarioClinicoSchema);
