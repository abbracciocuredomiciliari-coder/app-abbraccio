import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import EmailRicevuta from '../models/EmailRicevuta';

// ═══════════════════════════════════════════════════════════════════════════
// IMAP SYNC — scarica le email ricevute nella casella aziendale in
// EmailRicevuta. Non segna MAI i messaggi come letti sul server: i flag
// vengono letti prima del download e ripristinati dopo, per non interferire
// con la webmail/client di posta usati in ufficio.
//
// Config (env): IMAP_HOST (default imaps.aruba.it), IMAP_PORT (993),
// IMAP_USER / IMAP_PASS (default: credenziali SMTP).
// ═══════════════════════════════════════════════════════════════════════════

const MAX_TESTO = 200_000;
const MAX_HTML = 300_000;
const MAX_ALLEGATO = 5 * 1024 * 1024;       // 5MB per singolo allegato conservato
const MAX_ALLEGATI_TOT = 12 * 1024 * 1024;  // 12MB totali per messaggio
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
    logger: false as const,
  };
}

export interface SyncResult {
  ok: boolean;
  nuove: number;
  aggiornate: number;
  errore?: string;
}

export async function sincronizzaEmailRicevute(): Promise<SyncResult> {
  if (inCorso) return { ok: true, nuove: 0, aggiornate: 0, errore: 'Sync già in corso' };
  inCorso = true;
  const client = new ImapFlow(config());
  let nuove = 0;
  let aggiornate = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const ultimo = await EmailRicevuta.findOne().sort({ uid: -1 }).select('uid').lean();
      let uids: number[] = [];
      if (ultimo) {
        const trovati = await client.search({ uid: `${ultimo.uid + 1}:*` }, { uid: true });
        uids = (trovati as number[]).filter(u => u > ultimo.uid).sort((a, b) => a - b);
      } else {
        // Prima sincronizzazione: ultimi N giorni, max PRIMO_SYNC_MAX messaggi
        const since = new Date(Date.now() - PRIMO_SYNC_GIORNI * 86400_000);
        const trovati = await client.search({ since }, { uid: true });
        uids = (trovati as number[]).sort((a, b) => b - a).slice(0, PRIMO_SYNC_MAX).sort((a, b) => a - b);
      }

      for (const uid of uids) {
        try {
          // 1) Solo flags/envelope: non marca come letto
          const meta = await client.fetchOne(uid, { flags: true, envelope: true }, { uid: true });
          if (!meta) continue;
          const seenOnServer = meta.flags?.has('\\Seen') ?? false;

          const esistente = await EmailRicevuta.findOne({ uid }).select('letta').lean();
          if (esistente) {
            // Allinea lo stato "letta" se è cambiato sulla casella
            if (!!esistente.letta !== seenOnServer) {
              await EmailRicevuta.updateOne({ uid, letta: !seenOnServer }, { $set: { letta: seenOnServer } });
              aggiornate++;
            }
            continue;
          }

          // 2) Scarica il sorgente (imapflow usa BODY.PEEK: niente \Seen)
          const dl = await client.download(uid);
          let raw = Buffer.alloc(0);
          for await (const chunk of dl.content) raw = Buffer.concat([raw, chunk]);

          // 3) Ripristino difensivo del flag, nel caso il server l'avesse marcato
          if (!seenOnServer) {
            try { await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true }); } catch { /* noop */ }
          }

          const parsed = await simpleParser(raw);
          const addr = parsed.from?.value?.[0];
          const testo = (parsed.text || '').slice(0, MAX_TESTO);
          let html: string | undefined;
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

          await EmailRicevuta.create({
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
        } catch (e: any) {
          console.error(`[IMAP sync] Errore messaggio uid=${uid}:`, e?.message);
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
    return { ok: true, nuove, aggiornate };
  } catch (e: any) {
    try { await client.logout(); } catch { /* noop */ }
    console.error('[IMAP sync] Errore:', e?.responseText || e?.message);
    return { ok: false, nuove, aggiornate, errore: e?.responseText || e?.message || 'Errore IMAP' };
  } finally {
    inCorso = false;
  }
}

// Scheduler: sincronizza ogni N minuti (default 5). Primo giro 30s dopo l'avvio.
export function avviaImapSync() {
  const intervallo = Number(process.env.IMAP_SYNC_MINUTI || 5) * 60 * 1000;
  setInterval(() => { sincronizzaEmailRicevute().catch(() => {}); }, intervallo).unref();
  setTimeout(() => {
    sincronizzaEmailRicevute()
      .then(r => { if (r.ok) console.log(`[IMAP sync] ${r.nuove} nuove email ricevute`); else console.log(`[IMAP sync] ${r.errore}`); })
      .catch(() => {});
  }, 30_000).unref();
}

// Imposta/rimuove il flag \Seen sul server (mantiene gestionale e casella allineati)
export async function marcaFlagLettaSuServer(uid: number, letta: boolean): Promise<void> {
  const client = new ImapFlow(config());
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      if (letta) await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      else await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    try { await client.logout(); } catch { /* noop */ }
  }
}
