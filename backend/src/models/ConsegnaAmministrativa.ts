// @ts-nocheck
// Ripristinato dalla build deployata su Aruba (codice non committato in precedenza)
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const MovimentoSchema = new mongoose_1.Schema({
    azione: { type: String, required: true },
    da: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    daNome: { type: String },
    il: { type: Date, default: Date.now },
    nota: { type: String },
}, { _id: false });
const ConsegnaAmministrativaSchema = new mongoose_1.Schema({
    titolo: { type: String, required: true, trim: true, maxlength: 140 },
    testo: { type: String, required: true, trim: true, maxlength: 4000 },
    tipo: { type: String, enum: ['giornata', 'pratica', 'generale'], default: 'generale' },
    priorita: { type: String, enum: ['normale', 'urgente'], default: 'normale' },
    dataGiornata: { type: Date },
    riferimento: { type: String, trim: true, maxlength: 160 },
    stato: {
        type: String,
        enum: ['da_gestire', 'presa_in_carico', 'in_attesa_riscontro', 'gestita'],
        default: 'da_gestire',
        index: true,
    },
    autoreId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    autoreNome: { type: String, required: true },
    origine: { type: String, enum: ['interna', 'esterna'], default: 'interna' },
    presaInCaricoDaId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    presaInCaricoDaNome: { type: String },
    presaInCaricoIl: { type: Date },
    gestitaDaNome: { type: String },
    gestitaIl: { type: Date },
    storico: { type: [MovimentoSchema], default: [] },
}, { timestamps: true });
ConsegnaAmministrativaSchema.index({ createdAt: -1 });
exports.default = (0, mongoose_1.model)('ConsegnaAmministrativa', ConsegnaAmministrativaSchema);
