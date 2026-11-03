// @ts-nocheck
// Ripristinato dalla build deployata su Aruba (codice non committato in precedenza)
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const voceSchema = new mongoose_1.Schema({
    descrizione: { type: String, required: true, trim: true },
    quantita: { type: Number, default: 1 },
    prezzoUnitario: { type: Number, default: 0 },
    importo: { type: Number, default: 0 },
    tipo: { type: String, trim: true },
    aliquotaIva: { type: Number, default: 0 },
}, { _id: false });
const schema = new mongoose_1.Schema({
    area: { type: String, enum: ['privato', 'intermediazione'], required: true, index: true },
    tipo: { type: String, enum: ['preventivo_veloce', 'costo_badante'], required: true },
    canale: { type: String, enum: ['whatsapp', 'email'], required: true },
    nomeCliente: { type: String, trim: true },
    email: { type: String, trim: true },
    telefono: { type: String, trim: true },
    prestazioni: { type: [voceSchema], default: [] },
    totale: { type: Number },
    simulazione: { type: mongoose_1.Schema.Types.Mixed },
    testoInviato: { type: String },
    inviatoDa: { type: String, trim: true },
}, { timestamps: true });
schema.index({ area: 1, createdAt: -1 });
exports.default = (0, mongoose_1.model)('PreventivoInviato', schema);
