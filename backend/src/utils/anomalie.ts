import Attivita from '../models/Attivita';

// ═════════════════════════════════════════════════════════════════════════════
// ANOMALIA → ATTIVITÀ — un controllo non conforme non resta nella checklist:
// genera una lavorazione con responsabile, scadenza ed esito verificabile.
// ═════════════════════════════════════════════════════════════════════════════

export async function creaAttivitaAnomalia(params: {
  titolo: string;
  descrizione: string;
  praticaId: any;
  praticaLabel: string;
  autoreNome: string;
}): Promise<void> {
  try {
    const scadenza = new Date();
    scadenza.setDate(scadenza.getDate() + 2); // verifica entro 2 giorni
    await Attivita.create({
      titolo: params.titolo.slice(0, 200),
      azioneRichiesta: params.descrizione.slice(0, 2000),
      praticaTipo: 'checklist',
      praticaId: params.praticaId,
      praticaLabel: params.praticaLabel.slice(0, 200),
      area: 'organizzativa',
      priorita: 'alta',
      scadenza,
      autoreNome: params.autoreNome || 'Sistema',
      storico: [{ azione: 'creata', data: new Date(), autoreNome: 'Sistema', nota: 'Generata automaticamente da anomalia checklist' }],
    });
  } catch (e) {
    // L'attività è un'aggiunta: mai bloccare il salvataggio della checklist
    console.error('[Anomalia→Attività] Errore creazione:', e);
  }
}
