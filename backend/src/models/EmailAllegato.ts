// @ts-nocheck
// Ripristinato dalla build deployata su Aruba (codice non committato in precedenza)
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const schema = new mongoose_1.Schema({
    emailLogId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'EmailLog', required: true, index: true },
    filename: { type: String, required: true },
    contentType: { type: String },
    size: { type: Number, default: 0 },
    data: { type: Buffer, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
exports.default = (0, mongoose_1.model)('EmailAllegato', schema);
