import { Document, Schema, model, Types } from 'mongoose';

export interface IWorkPlanAccess extends Document {
  workPlan: Types.ObjectId;
  staffId: Types.ObjectId;
  staffName: string;
  staffRole: string;
  oraEntrata: Date;
  oraUscita?: Date;
  note?: string;
  firmaLogin: string;              // nome utente che ha firmato (semplice)
  ipAddress?: string;
  durataMinuti?: number;           // durata in minuti (calcolata all'uscita)
  compensoMaturato?: number;       // compenso guadagnato per questo singolo accesso
  
  // === FIRME TOUCH (canvas) ===
  firmaOperatore?: string;         // Base64 immagine firma operatore (PNG)
  firmaPaziente?: string;          // Base64 immagine firma paziente/caregiver (PNG)
  nomeFirmatarioPaziente?: string; // Nome del firmatario (paziente o caregiver)
  ruoloFirmatario?: 'paziente' | 'caregiver';  // Chi ha firmato
  firmatoAllaPartenza?: boolean;   // Firma paziente raccolta all'uscita
  
  // === MARCATURA TEMPORALE (RFC 3161) ===
  documentHash?: string;           // SHA-256 del documento serializzato
  timestampEntrata?: {
    timestamp: Date;               // Data/ora marcatura entrata
    timestampToken: string;      // Token TSA (Base64)
    serialNumber: string;          // Numero seriale marca
    tsaName: string;               // Nome TSA
    hashAlgorithm: string;       // Algoritmo hash
    hashValue: string;           // Hash marcato
  };
  timestampUscita?: {
    timestamp: Date;               // Data/ora marcatura uscita
    timestampToken: string;      // Token TSA (Base64)
    serialNumber: string;          // Numero seriale marca
    tsaName: string;               // Nome TSA
    hashAlgorithm: string;         // Algoritmo hash
    hashValue: string;             // Hash marcato
  };
  
  // === FIRMA DIGITALE AVANZATA (preparazione per futuro) ===
  firmaDigitaleEntrata?: {
    tipo: 'FEA' | 'FES' | 'FEQ';
    provider?: string;
    hashToSign?: string;
    signatureValue?: string;
    certificateSN?: string;
    certificateIssuer?: string;
    signedAt?: Date;
    validFrom?: Date;
    validTo?: Date;
    verificationStatus?: 'valid' | 'expired' | 'revoked' | 'error';
  };
  firmaDigitaleUscita?: {
    tipo: 'FEA' | 'FES' | 'FEQ';
    provider?: string;
    hashToSign?: string;
    signatureValue?: string;
    certificateSN?: string;
    certificateIssuer?: string;
    signedAt?: Date;
    validFrom?: Date;
    validTo?: Date;
    verificationStatus?: 'valid' | 'expired' | 'revoked' | 'error';
  };
}

// Schema per timestamp
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

const workPlanAccessSchema = new Schema<IWorkPlanAccess>(
  {
    workPlan: { type: Schema.Types.ObjectId, ref: 'WorkPlan', required: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff', required: true },
    staffName: { type: String, required: true },
    staffRole: { type: String, required: true },
    oraEntrata: { type: Date, required: true },
    oraUscita: { type: Date },
    note: { type: String, trim: true },
    firmaLogin: { type: String, required: true },
    ipAddress: { type: String },
    durataMinuti: { type: Number, default: 0 },
    compensoMaturato: { type: Number, default: 0 },
    
    // Firme touch
    firmaOperatore: { type: String },
    firmaPaziente: { type: String },
    nomeFirmatarioPaziente: { type: String },
    ruoloFirmatario: { type: String, enum: ['paziente', 'caregiver'] },
    firmatoAllaPartenza: { type: Boolean, default: false },
    
    // Marcatura temporale
    documentHash: { type: String },
    timestampEntrata: { type: timestampSchema },
    timestampUscita: { type: timestampSchema },
    
    // Firma digitale
    firmaDigitaleEntrata: { type: firmaDigitaleSchema },
    firmaDigitaleUscita: { type: firmaDigitaleSchema },
  },
  { timestamps: true }
);

export default model<IWorkPlanAccess>('WorkPlanAccess', workPlanAccessSchema);
