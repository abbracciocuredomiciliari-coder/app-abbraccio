// @ts-nocheck
// Ripristinato dalla build deployata su Aruba (codice non committato in precedenza)
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sincronizzaEmailRicevute = sincronizzaEmailRicevute;
exports.avviaImapSync = avviaImapSync;
exports.marcaFlagLettaSuServer = marcaFlagLettaSuServer;
const imapflow_1 = require("imapflow");
const mailparser_1 = require("mailparser");
const EmailRicevuta_1 = __importDefault(require("../models/EmailRicevuta"));
const MAX_TESTO = 200000;
const MAX_HTML = 300000;
const MAX_ALLEGATO = 5 * 1024 * 1024;
const MAX_ALLEGATI_TOT = 12 * 1024 * 1024;
const PRIMO_SYNC_GIORNI = 90;
const PRIMO_SYNC_MAX = 300;
let inCorso = false;
function config() {
    return {
        host: process.env.IMAP_HOST || 'imaps.aruba.it',
        port: Number(process.env.IMAP_PORT || 993),
        secure: true,
        auth: {
            user: process.env.IMAP_USER || process.env.SMTP_USER || '',
            pass: process.env.IMAP_PASS || process.env.SMTP_PASS || '',
        },
        logger: false,
    };
}
async function sincronizzaEmailRicevute() {
    if (inCorso)
        return { ok: true, nuove: 0, aggiornate: 0, errore: 'Sync già in corso' };
    inCorso = true;
    const client = new imapflow_1.ImapFlow(config());
    let nuove = 0;
    let aggiornate = 0;
    try {
        await client.connect();
        const lock = await client.getMailboxLock('INBOX');
        try {
            const ultimo = await EmailRicevuta_1.default.findOne().sort({ uid: -1 }).select('uid').lean();
            let uids = [];
            if (ultimo) {
                const trovati = await client.search({ uid: `${ultimo.uid + 1}:*` }, { uid: true });
                uids = trovati.filter(u => u > ultimo.uid).sort((a, b) => a - b);
            }
            else {
                const since = new Date(Date.now() - PRIMO_SYNC_GIORNI * 86400000);
                const trovati = await client.search({ since }, { uid: true });
                uids = trovati.sort((a, b) => b - a).slice(0, PRIMO_SYNC_MAX).sort((a, b) => a - b);
            }
            for (const uid of uids) {
                try {
                    const meta = await client.fetchOne(uid, { flags: true, envelope: true }, { uid: true });
                    if (!meta)
                        continue;
                    const seenOnServer = meta.flags?.has('\\Seen') ?? false;
                    const esistente = await EmailRicevuta_1.default.findOne({ uid }).select('letta').lean();
                    if (esistente) {
                        if (!!esistente.letta !== seenOnServer) {
                            await EmailRicevuta_1.default.updateOne({ uid, letta: !seenOnServer }, { $set: { letta: seenOnServer } });
                            aggiornate++;
                        }
                        continue;
                    }
                    const dl = await client.download(uid);
                    let raw = Buffer.alloc(0);
                    for await (const chunk of dl.content)
                        raw = Buffer.concat([raw, chunk]);
                    if (!seenOnServer) {
                        try {
                            await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true });
                        }
                        catch { }
                    }
                    const parsed = await (0, mailparser_1.simpleParser)(raw);
                    const addr = parsed.from?.value?.[0];
                    const testo = (parsed.text || '').slice(0, MAX_TESTO);
                    let html;
                    if (parsed.html) {
                        html = typeof parsed.html === 'string' ? parsed.html.slice(0, MAX_HTML) : undefined;
                    }
                    let sizeTot = 0;
                    const allegati = (parsed.attachments || []).map(a => {
                        sizeTot += a.size || 0;
                        const conserva = (a.size || 0) <= MAX_ALLEGATO && sizeTot <= MAX_ALLEGATI_TOT && !!a.content;
                        return {
                            filename: a.filename || 'allegato',
                            contentType: a.contentType || 'application/octet-stream',
                            size: a.size || 0,
                            data: conserva ? a.content : undefined,
                        };
                    });
                    await EmailRicevuta_1.default.create({
                        uid,
                        messageId: parsed.messageId || undefined,
                        from: { nome: addr?.name || undefined, email: addr?.address || 'sconosciuto' },
                        to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap(t => t.value.map(v => v.address || '')).filter(Boolean) : [],
                        subject: parsed.subject || '(senza oggetto)',
                        data: parsed.date || meta.envelope?.date || new Date(),
                        snippet: testo.replace(/\s+/g, ' ').trim().slice(0, 200),
                        testo,
                        html,
                        allegati,
                        letta: seenOnServer,
                        inReplyTo: parsed.inReplyTo || undefined,
                    });
                    nuove++;
                }
                catch (e) {
                    console.error(`[IMAP sync] Errore messaggio uid=${uid}:`, e?.message);
                }
            }
        }
        finally {
            lock.release();
        }
        await client.logout();
        return { ok: true, nuove, aggiornate };
    }
    catch (e) {
        try {
            await client.logout();
        }
        catch { }
        console.error('[IMAP sync] Errore:', e?.responseText || e?.message);
        return { ok: false, nuove, aggiornate, errore: e?.responseText || e?.message || 'Errore IMAP' };
    }
    finally {
        inCorso = false;
    }
}
function avviaImapSync() {
    const intervallo = Number(process.env.IMAP_SYNC_MINUTI || 5) * 60 * 1000;
    setInterval(() => { sincronizzaEmailRicevute().catch(() => { }); }, intervallo).unref();
    setTimeout(() => {
        sincronizzaEmailRicevute()
            .then(r => { if (r.ok)
            console.log(`[IMAP sync] ${r.nuove} nuove email ricevute`);
        else
            console.log(`[IMAP sync] ${r.errore}`); })
            .catch(() => { });
    }, 30000).unref();
}
async function marcaFlagLettaSuServer(uid, letta) {
    const client = new imapflow_1.ImapFlow(config());
    try {
        await client.connect();
        const lock = await client.getMailboxLock('INBOX');
        try {
            if (letta)
                await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
            else
                await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true });
        }
        finally {
            lock.release();
        }
    }
    finally {
        try {
            await client.logout();
        }
        catch { }
    }
}
