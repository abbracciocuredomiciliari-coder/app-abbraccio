import ColloquioIntermediazione from '../models/ColloquioIntermediazione';
import { inviaEmailPromemoria } from '../routes/colloquiIntermediazione';

// ═══════════════════════════════════════════════════════════════════════════
// PROMEMORIA COLLOQUI INTERMEDIAZIONE
// Ogni 30 minuti cerca i colloqui programmati per OGGI a cui non è ancora
// stato inviato il promemoria e manda ai partecipanti (esclusi i rifiutati)
// l'email con il link di collegamento (Jitsi/Meet o luogo/telefono).
// ═══════════════════════════════════════════════════════════════════════════

const INTERVALLO_MS = 30 * 60 * 1000;

async function inviaPromemoriaDiOggi() {
  try {
    const inizio = new Date(); inizio.setHours(0, 0, 0, 0);
    const fine = new Date(inizio); fine.setDate(fine.getDate() + 1);
    const colloqui = await ColloquioIntermediazione.find({
      stato: 'programmato',
      promemoriaInviatoIl: { $exists: false },
      dataRiunione: { $gte: inizio, $lt: fine },
    });
    for (const c of colloqui) {
      try {
        const inviate = await inviaEmailPromemoria(c);
        console.log(`[Promemoria colloqui] "${c.titolo}" del ${c.dataRiunione.toISOString()} — inviati ${inviate} promemoria`);
      } catch (e: any) {
        console.error(`[Promemoria colloqui] Errore su colloquio ${c._id}:`, e.message);
      }
    }
  } catch (e: any) {
    console.error('[Promemoria colloqui] Errore ciclo:', e.message);
  }
}

export function avviaPromemoriaColloqui() {
  inviaPromemoriaDiOggi();
  const timer = setInterval(inviaPromemoriaDiOggi, INTERVALLO_MS);
  if (typeof timer.unref === 'function') timer.unref();
  console.log('[Promemoria colloqui] Scheduler attivo (controllo ogni 30 minuti)');
}
