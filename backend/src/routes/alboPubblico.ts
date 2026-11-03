// @ts-nocheck
// Ripristinato dalla build deployata su Aruba (codice non committato in precedenza)
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const Staff_1 = __importDefault(require("../models/Staff"));
const router = (0, express_1.Router)();
const CAT_LABEL = {
    badante: 'Badante', colf: 'Colf', 'assistente-familiare': 'Assistente familiare',
    oss: 'OSS', infermieristico: 'Infermiere', medico: 'Medico',
    riabilitativo: 'Fisioterapista', sociale: 'Operatore sociale', osa: 'OSA',
};
const CAT_AMMESSE = Object.keys(CAT_LABEL);
const jitter = (id) => {
    const h = crypto_1.default.createHash('sha256').update(`albo:${id}`).digest();
    const ang = (h[0] / 255) * 2 * Math.PI;
    const dist = 0.008 + (h[1] / 255) * 0.012;
    return { dLat: Math.cos(ang) * dist, dLng: (Math.sin(ang) * dist) / Math.cos(Math.PI / 4) };
};
router.get('/mappa', async (_req, res) => {
    try {
        const staff = await Staff_1.default.find({
            active: { $ne: false },
            category: { $in: CAT_AMMESSE },
            'domicilioCoords.lat': { $exists: true, $ne: null },
            'domicilioCoords.lng': { $exists: true, $ne: null },
        }).select('domicilioCoords category').lean();
        const marker = staff.map((s) => {
            const j = jitter(String(s._id));
            return {
                lat: +(s.domicilioCoords.lat + j.dLat).toFixed(4),
                lng: +(s.domicilioCoords.lng + j.dLng).toFixed(4),
                cat: CAT_LABEL[s.category] || 'Operatore',
            };
        });
        res.set('Cache-Control', 'public, max-age=300');
        return res.json({ totale: marker.length, marker });
    }
    catch (error) {
        console.error('[Albo] Errore mappa:', error);
        return res.status(500).json({ message: 'Errore caricamento mappa' });
    }
});
export default router;