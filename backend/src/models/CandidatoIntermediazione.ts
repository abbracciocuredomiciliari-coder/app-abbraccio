// @ts-nocheck
// Ripristinato dalla build deployata su Aruba (codice non committato in precedenza)
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const schema = new mongoose_1.Schema({
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
    staffId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Staff' },
    noteAdmin: { type: String, trim: true },
    richiesteDati: [{ at: { type: Date, default: Date.now }, campi: [{ type: String }], canale: { type: String, enum: ['email', 'whatsapp'] } }],
}, { timestamps: true });
schema.index({ stato: 1, createdAt: -1 });
exports.default = (0, mongoose_1.model)('CandidatoIntermediazione', schema);
