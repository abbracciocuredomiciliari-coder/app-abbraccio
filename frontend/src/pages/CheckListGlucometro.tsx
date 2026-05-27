import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

type RisultatoControllo = 'basso' | 'normale' | 'alto' | '';

interface LivelloControllo {
  risultato: RisultatoControllo;
  passato: boolean;
  note: string;
}

interface CheckListGlucometroEntry {
  _id: string;
  dataControllo: string;
  idGlucometro: string;
  operatore: string;
  livelloBasso: LivelloControllo;
  livelloNormale: LivelloControllo;
  livelloAlto: LivelloControllo;
  controlloSuperato: boolean;
  note: string;
  createdAt: string;
}

// ─── Configurazione livelli ───────────────────────────────────────────────────

const LIVELLI: {
  key: 'livelloBasso' | 'livelloNormale' | 'livelloAlto';
  label: string;
  descrizione: string;
  colore: string;
  coloreSfondo: string;
  emoji: string;
}[] = [
  {
    key: 'livelloBasso',
    label: 'Livello Basso',
    descrizione: 'Soluzione di controllo a concentrazione bassa',
    colore: '#2563eb',
    coloreSfondo: '#eff6ff',
    emoji: '🔵',
  },
  {
    key: 'livelloNormale',
    label: 'Livello Normale',
    descrizione: 'Soluzione di controllo a concentrazione normale',
    colore: '#16a34a',
    coloreSfondo: '#f0fdf4',
    emoji: '🟢',
  },
  {
    key: 'livelloAlto',
    label: 'Livello Alto',
    descrizione: 'Soluzione di controllo a concentrazione alta',
    colore: '#dc2626',
    coloreSfondo: '#fef2f2',
    emoji: '🔴',
  },
];

const RISULTATI: { value: RisultatoControllo; label: string; colore: string }[] = [
  { value: '', label: '— Non eseguito —', colore: '#9ca3af' },
  { value: 'basso', label: 'Basso', colore: '#2563eb' },
  { value: 'normale', label: 'Normale', colore: '#16a34a' },
  { value: 'alto', label: 'Alto', colore: '#dc2626' },
];

// ─── Stato iniziale form ──────────────────────────────────────────────────────

const oggiISO = () => new Date().toISOString().substring(0, 10);

const livelloVuoto = (): LivelloControllo => ({ risultato: '', passato: false, note: '' });

const formVuoto = (nome = '') => ({
  dataControllo: oggiISO(),
  idGlucometro: '',
  operatore: nome,
  livelloBasso: livelloVuoto(),
  livelloNormale: livelloVuoto(),
  livelloAlto: livelloVuoto(),
  controlloSuperato: false,
  note: '',
});

// ─── Componente principale ────────────────────────────────────────────────────

function CheckListGlucometro() {
  const { user } = useAuth();
  const [storico, setStorico] = useState<CheckListGlucometroEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mostraForm, setMostraForm] = useState(false);
  const [entryAperta, setEntryAperta] = useState<string | null>(null);

  const [form, setForm] = useState(formVuoto(user?.name || ''));

  useEffect(() => {
    fetchStorico();
  }, []);

  const fetchStorico = async () => {
    try {
      const res = await api.get('/checklist-glucometro');
      setStorico(res.data);
    } catch (err) {
      console.warn('Errore nel caricamento dello storico glucometro:', err);
    } finally {
      setLoading(false);
    }
  };

  const apriForm = () => {
    setForm(formVuoto(user?.name || ''));
    setMostraForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Aggiorna un livello di controllo ────────────────────────────────────────

  const aggiornaLivello = (
    key: 'livelloBasso' | 'livelloNormale' | 'livelloAlto',
    campo: keyof LivelloControllo,
    valore: string | boolean
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: { ...prev[key], [campo]: valore },
    }));
  };

  // ─── Calcola esito complessivo automaticamente ────────────────────────────────

  const calcolaEsitoComplessivo = (f: typeof form) =>
    f.livelloBasso.passato && f.livelloNormale.passato && f.livelloAlto.passato;

  // ─── Salvataggio ─────────────────────────────────────────────────────────────

  const salvaChecklist = async () => {
    if (!form.operatore.trim()) {
      alert('Il campo "Operatore" è obbligatorio');
      return;
    }
    if (!form.dataControllo) {
      alert('La data di controllo è obbligatoria');
      return;
    }
    const payload = {
      ...form,
      controlloSuperato: calcolaEsitoComplessivo(form),
    };
    setSalvando(true);
    try {
      const res = await api.post('/checklist-glucometro', payload);
      setStorico([res.data, ...storico]);
      setMostraForm(false);
      alert('Checklist glucometro salvata con successo!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel salvataggio');
    } finally {
      setSalvando(false);
    }
  };

  const eliminaChecklist = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa checklist?')) return;
    try {
      await api.delete(`/checklist-glucometro/${id}`);
      setStorico(storico.filter((s) => s._id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.message || "Errore durante l'eliminazione");
    }
  };

  // ─── Stampa PDF ───────────────────────────────────────────────────────────────

  const stampaChecklist = (entry: CheckListGlucometroEntry) => {
    const dataStr = new Date(entry.dataControllo).toLocaleDateString('it-IT');

    const righeTabella = LIVELLI.map((liv) => {
      const livello = entry[liv.key];
      const risultatoLabel = RISULTATI.find((r) => r.value === livello.risultato)?.label || '—';
      return `<tr>
        <td style="padding:9px 12px;border:1px solid #ddd;">${liv.emoji} ${liv.label}</td>
        <td style="padding:9px 12px;border:1px solid #ddd;">${liv.descrizione}</td>
        <td style="padding:9px 12px;border:1px solid #ddd;text-align:center;font-weight:700;color:${
          livello.risultato === 'basso' ? '#2563eb' : livello.risultato === 'normale' ? '#16a34a' : livello.risultato === 'alto' ? '#dc2626' : '#9ca3af'
        };">${risultatoLabel}</td>
        <td style="padding:9px 12px;border:1px solid #ddd;text-align:center;font-size:18px;">${livello.passato ? '✅' : '☐'}</td>
        <td style="padding:9px 12px;border:1px solid #ddd;color:#555;font-size:12px;">${livello.note || ''}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <title>Controllo Qualità Glucometro — ${dataStr}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #222; font-size: 13px; }
    .intestazione { display: flex; align-items: center; gap: 20px; border-bottom: 3px solid #1e4d8c; padding-bottom: 14px; margin-bottom: 18px; }
    .intestazione img { height: 70px; width: auto; }
    .intestazione .testo h1 { margin: 0; font-size: 18px; color: #1e4d8c; }
    .intestazione .testo p { margin: 3px 0 0; font-size: 11px; color: #666; }
    .info-box { background: #f5f8fc; border: 1px solid #d0dff0; border-radius: 6px; padding: 10px 16px; margin-bottom: 16px; }
    .info-box strong { color: #1e4d8c; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
    th { background: #1e4d8c; color: #fff; padding: 8px 12px; text-align: left; }
    td { vertical-align: middle; }
    .esito-box { margin: 16px 0; padding: 12px 16px; border-radius: 6px; font-weight: 700; font-size: 14px; }
    .esito-ok { background: rgba(22,163,74,0.1); border: 2px solid #16a34a; color: #14532d; }
    .esito-ko { background: rgba(220,38,38,0.08); border: 2px solid #dc2626; color: #7f1d1d; }
    .note-box { background: #fffbe6; border: 1px solid #ffe58f; border-radius: 6px; padding: 10px 14px; font-size: 12px; margin-bottom: 14px; }
    .firma-box { margin-top: 24px; border-top: 1px solid #ddd; padding-top: 12px; }
    .footer { margin-top: 16px; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 6px; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <div class="intestazione">
    <img src="${window.location.origin}/logo.png" alt="Abbraccio Cure Domiciliari" onerror="this.style.display='none'" />
    <div class="testo">
      <h1>🩸 Controllo Qualità Glucometro</h1>
      <p>Abbraccio Cure Domiciliari — Verifica soluzioni di controllo</p>
    </div>
  </div>

  <div class="info-box">
    <strong>Data controllo:</strong> ${dataStr} &nbsp;&nbsp;
    <strong>ID Glucometro:</strong> ${entry.idGlucometro || '____________________'} &nbsp;&nbsp;
    <strong>Operatore:</strong> ${entry.operatore}
  </div>

  <table>
    <thead>
      <tr>
        <th>Livello</th>
        <th>Descrizione</th>
        <th style="width:90px;text-align:center;">Risultato</th>
        <th style="width:70px;text-align:center;">Passato</th>
        <th style="width:180px;">Note</th>
      </tr>
    </thead>
    <tbody>${righeTabella}</tbody>
  </table>

  <div class="esito-box ${entry.controlloSuperato ? 'esito-ok' : 'esito-ko'}">
    ${entry.controlloSuperato
      ? '✅ CONTROLLO SUPERATO — Tutti e tre i livelli hanno dato esito positivo'
      : '⚠️ CONTROLLO NON SUPERATO — Uno o più livelli non hanno dato esito positivo'}
  </div>

  ${entry.note ? `<div class="note-box"><strong>Note:</strong> ${entry.note}</div>` : ''}

  <div class="firma-box">
    <strong>Operatore:</strong> ${entry.operatore}
  </div>
  <div class="footer">Documento generato automaticamente da Abbraccio Cure Domiciliari — ${new Date().toLocaleString('it-IT')}</div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    }
  };

  // ─── Stampa storico completo ──────────────────────────────────────────────────

  const stampaStoricoCompleto = () => {
    if (storico.length === 0) {
      alert('Nessuna checklist da stampare');
      return;
    }

    const righeStorico = storico.map((entry) => {
      const dataStr = new Date(entry.dataControllo).toLocaleDateString('it-IT');
      const livelli = LIVELLI.map((liv) => {
        const l = entry[liv.key];
        const ris = RISULTATI.find((r) => r.value === l.risultato)?.label || '—';
        return `${liv.emoji} ${ris} ${l.passato ? '✅' : '☐'}`;
      }).join(' | ');
      return `<tr>
        <td style="padding:7px 10px;border:1px solid #ddd;">${dataStr}</td>
        <td style="padding:7px 10px;border:1px solid #ddd;">${entry.idGlucometro || '—'}</td>
        <td style="padding:7px 10px;border:1px solid #ddd;">${livelli}</td>
        <td style="padding:7px 10px;border:1px solid #ddd;text-align:center;font-weight:700;color:${entry.controlloSuperato ? '#16a34a' : '#dc2626'};">
          ${entry.controlloSuperato ? '✅ OK' : '❌ KO'}
        </td>
        <td style="padding:7px 10px;border:1px solid #ddd;">${entry.operatore}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <title>Storico Controlli Glucometro</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #222; font-size: 12px; }
    .intestazione { display: flex; align-items: center; gap: 20px; border-bottom: 3px solid #1e4d8c; padding-bottom: 14px; margin-bottom: 18px; }
    .intestazione img { height: 60px; width: auto; }
    .intestazione .testo h1 { margin: 0; font-size: 17px; color: #1e4d8c; }
    .intestazione .testo p { margin: 3px 0 0; font-size: 11px; color: #666; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #1e4d8c; color: #fff; padding: 8px 10px; text-align: left; }
    td { vertical-align: middle; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer { margin-top: 16px; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 6px; }
    @media print { body { margin: 8mm; } }
  </style>
</head>
<body>
  <div class="intestazione">
    <img src="${window.location.origin}/logo.png" alt="Abbraccio Cure Domiciliari" onerror="this.style.display='none'" />
    <div class="testo">
      <h1>🩸 Storico Controlli Qualità Glucometro</h1>
      <p>Abbraccio Cure Domiciliari — ${storico.length} controlli registrati — Stampato il ${new Date().toLocaleDateString('it-IT')}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>ID Glucometro</th>
        <th>Livelli (Basso | Normale | Alto)</th>
        <th style="width:70px;text-align:center;">Esito</th>
        <th>Operatore</th>
      </tr>
    </thead>
    <tbody>${righeStorico}</tbody>
  </table>
  <div class="footer">Documento generato automaticamente da Abbraccio Cure Domiciliari — ${new Date().toLocaleString('it-IT')}</div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    }
  };

  // ─── Calcoli stato form ───────────────────────────────────────────────────────

  const tuttiPassatiForm = calcolaEsitoComplessivo(form);
  const livPassatiForm = [form.livelloBasso, form.livelloNormale, form.livelloAlto].filter((l) => l.passato).length;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <section>
      <h2>🩸 Check List Glucometro</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: '24px', fontSize: '0.95rem' }}>
        Controllo qualità glucometro — Verifica soluzioni di controllo a tre livelli (Basso / Normale / Alto)
      </p>

      {/* Pulsanti azione */}
      {!mostraForm && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={apriForm}
            style={{ background: '#1e4d8c', fontSize: '1rem', padding: '10px 22px' }}
          >
            ➕ Nuovo controllo glucometro
          </button>
          {storico.length > 0 && (
            <button
              type="button"
              onClick={stampaStoricoCompleto}
              style={{ background: '#059669', fontSize: '1rem', padding: '10px 22px' }}
            >
              🖨️ Stampa storico completo
            </button>
          )}
        </div>
      )}

      {/* ─── Form compilazione ─────────────────────────────────────────────────── */}
      {mostraForm && (
        <div
          className="dashboard-folder"
          style={{ marginBottom: '32px', border: '2px solid #1e4d8c', borderRadius: '10px', padding: '24px' }}
        >
          {/* Intestazione form */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#1e4d8c' }}>
              📝 Nuovo Controllo — {new Date(form.dataControllo).toLocaleDateString('it-IT')}
            </h3>
            <button
              type="button"
              onClick={() => setMostraForm(false)}
              style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
            >
              ×
            </button>
          </div>

          {/* Dati identificativi */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Data controllo *</span>
              <input
                type="date"
                value={form.dataControllo}
                onChange={(e) => setForm({ ...form, dataControllo: e.target.value })}
                style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>ID Glucometro</span>
              <input
                type="text"
                value={form.idGlucometro}
                onChange={(e) => setForm({ ...form, idGlucometro: e.target.value })}
                placeholder="Es. GLU-001"
                style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Operatore *</span>
              <input
                type="text"
                value={form.operatore}
                onChange={(e) => setForm({ ...form, operatore: e.target.value })}
                placeholder="Es. Mario Rossi"
                style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }}
              />
            </label>
          </div>

          {/* ─── Tre livelli di controllo ─────────────────────────────────────── */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ marginBottom: '16px', color: '#1e4d8c' }}>🧪 Test Soluzioni di Controllo</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {LIVELLI.map((liv) => {
                const livello = form[liv.key];
                return (
                  <div
                    key={liv.key}
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      border: `2px solid ${livello.passato ? liv.colore : '#dee2e6'}`,
                      background: livello.passato ? liv.coloreSfondo : '#fafafa',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '20px' }}>{liv.emoji}</span>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: liv.colore }}>{liv.label}</div>
                        <div style={{ fontSize: '0.82rem', color: '#666' }}>{liv.descrizione}</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'center' }}>
                      {/* Risultato */}
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#555' }}>Risultato ottenuto</span>
                        <select
                          value={livello.risultato}
                          onChange={(e) => aggiornaLivello(liv.key, 'risultato', e.target.value)}
                          style={{
                            padding: '7px 10px',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontWeight: '600',
                            color:
                              livello.risultato === 'basso'
                                ? '#2563eb'
                                : livello.risultato === 'normale'
                                ? '#16a34a'
                                : livello.risultato === 'alto'
                                ? '#dc2626'
                                : '#9ca3af',
                          }}
                        >
                          {RISULTATI.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      {/* Note */}
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#555' }}>Note</span>
                        <input
                          type="text"
                          value={livello.note}
                          onChange={(e) => aggiornaLivello(liv.key, 'note', e.target.value)}
                          placeholder="Note opzionali..."
                          style={{ padding: '7px 10px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px' }}
                        />
                      </label>

                      {/* Checkbox passato */}
                      <label
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: livello.passato ? liv.coloreSfondo : '#f3f4f6',
                          border: `1px solid ${livello.passato ? liv.colore : '#d1d5db'}`,
                          transition: 'all 0.15s',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={livello.passato}
                          onChange={(e) => aggiornaLivello(liv.key, 'passato', e.target.checked)}
                          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            color: livello.passato ? liv.colore : '#6b7280',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {livello.passato ? '✅ Passato' : 'Passato?'}
                        </span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Indicatore esito complessivo */}
            <div
              style={{
                marginTop: '16px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: tuttiPassatiForm ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.08)',
                border: `2px solid ${tuttiPassatiForm ? '#16a34a' : '#dc2626'}`,
                color: tuttiPassatiForm ? '#14532d' : '#7f1d1d',
                fontWeight: '700',
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {tuttiPassatiForm
                ? '✅ CONTROLLO SUPERATO — Tutti e tre i livelli hanno dato esito positivo'
                : `⚠️ ${livPassatiForm}/3 livelli passati — Controllo non ancora superato`}
            </div>
          </div>

          {/* Note generali */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '20px' }}>
            <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Note generali</span>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Note aggiuntive sul controllo..."
              rows={2}
              style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px', resize: 'vertical' }}
            />
          </label>

          {/* Pulsanti azione */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={salvaChecklist}
              disabled={salvando}
              style={{ background: '#28a745', padding: '10px 24px', fontSize: '15px', opacity: salvando ? 0.7 : 1 }}
            >
              {salvando ? '⏳ Salvataggio...' : '💾 Salva controllo'}
            </button>
            <button
              type="button"
              onClick={() => setMostraForm(false)}
              style={{ background: '#6c757d', padding: '10px 24px', fontSize: '15px' }}
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* ─── Storico controlli ───────────────────────────────────────────────── */}
      <div className="dashboard-folder">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0 }}>📂 Storico controlli glucometro</h3>
          {storico.length > 0 && (
            <button
              type="button"
              onClick={stampaStoricoCompleto}
              style={{ background: '#059669', fontSize: '0.85rem', padding: '7px 16px' }}
            >
              🖨️ Stampa storico completo
            </button>
          )}
        </div>

        {loading ? (
          <p>Caricamento...</p>
        ) : storico.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>
            Nessun controllo registrato. Clicca "Nuovo controllo glucometro" per iniziare.
          </p>
        ) : (
          <div className="document-list">
            <ul>
              {storico.map((entry) => {
                const aperta = entryAperta === entry._id;
                return (
                  <li key={entry._id}>
                    {/* Riga riassuntiva */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '1rem' }}>
                          {new Date(entry.dataControllo).toLocaleDateString('it-IT', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </strong>
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '0.88rem',
                            color: '#555',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '12px',
                          }}
                        >
                          {entry.idGlucometro && <span>🔢 ID: <strong>{entry.idGlucometro}</strong></span>}
                          <span>👤 {entry.operatore}</span>
                          {/* Badge livelli */}
                          {LIVELLI.map((liv) => {
                            const l = entry[liv.key];
                            return (
                              <span
                                key={liv.key}
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '2px 7px',
                                  borderRadius: '10px',
                                  fontWeight: '600',
                                  background: l.passato ? `${liv.colore}15` : 'rgba(220,38,38,0.08)',
                                  color: l.passato ? liv.colore : '#dc2626',
                                  border: `1px solid ${l.passato ? liv.colore : '#dc2626'}`,
                                }}
                              >
                                {liv.emoji} {l.passato ? '✓' : '✗'}
                              </span>
                            );
                          })}
                          <span
                            style={{
                              fontWeight: '700',
                              color: entry.controlloSuperato ? '#14532d' : '#7f1d1d',
                              background: entry.controlloSuperato ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.08)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: `1px solid ${entry.controlloSuperato ? '#16a34a' : '#dc2626'}`,
                            }}
                          >
                            {entry.controlloSuperato ? '✅ Superato' : '❌ Non superato'}
                          </span>
                        </div>
                        {entry.note && (
                          <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
                            💬 {entry.note}
                          </div>
                        )}
                      </div>

                      {/* Pulsanti */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setEntryAperta(aperta ? null : entry._id)}
                          style={{ background: '#6c757d', fontSize: '0.85rem', padding: '6px 14px' }}
                        >
                          {aperta ? '▲ Chiudi' : '▼ Dettagli'}
                        </button>
                        <button
                          type="button"
                          onClick={() => stampaChecklist(entry)}
                          style={{ background: '#1e4d8c', fontSize: '0.85rem', padding: '6px 14px' }}
                        >
                          🖨️ Stampa PDF
                        </button>
                        {user && (user.role === 'admin' || user.role === 'coordinator') && (
                          <button
                            type="button"
                            onClick={() => eliminaChecklist(entry._id)}
                            style={{ background: '#dc3545', fontSize: '0.85rem', padding: '6px 14px' }}
                          >
                            Elimina
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Dettaglio espandibile */}
                    {aperta && (
                      <div
                        style={{
                          marginTop: '14px',
                          padding: '16px',
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          border: '1px solid #dee2e6',
                        }}
                      >
                        <strong style={{ color: '#1e4d8c', fontSize: '0.9rem', display: 'block', marginBottom: '10px' }}>
                          🧪 Dettaglio livelli di controllo
                        </strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {LIVELLI.map((liv) => {
                            const l = entry[liv.key];
                            const ris = RISULTATI.find((r) => r.value === l.risultato)?.label || '—';
                            return (
                              <div
                                key={liv.key}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  padding: '10px 14px',
                                  borderRadius: '6px',
                                  background: l.passato ? liv.coloreSfondo : 'rgba(220,38,38,0.05)',
                                  border: `1px solid ${l.passato ? liv.colore : '#f5c6cb'}`,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span style={{ fontSize: '18px' }}>{liv.emoji}</span>
                                <span style={{ fontWeight: '700', color: liv.colore, minWidth: '120px' }}>{liv.label}</span>
                                <span
                                  style={{
                                    padding: '2px 10px',
                                    borderRadius: '10px',
                                    fontSize: '0.82rem',
                                    fontWeight: '700',
                                    background:
                                      l.risultato === 'basso'
                                        ? '#eff6ff'
                                        : l.risultato === 'normale'
                                        ? '#f0fdf4'
                                        : l.risultato === 'alto'
                                        ? '#fef2f2'
                                        : '#f3f4f6',
                                    color:
                                      l.risultato === 'basso'
                                        ? '#2563eb'
                                        : l.risultato === 'normale'
                                        ? '#16a34a'
                                        : l.risultato === 'alto'
                                        ? '#dc2626'
                                        : '#9ca3af',
                                    border: `1px solid ${
                                      l.risultato === 'basso'
                                        ? '#bfdbfe'
                                        : l.risultato === 'normale'
                                        ? '#bbf7d0'
                                        : l.risultato === 'alto'
                                        ? '#fecaca'
                                        : '#e5e7eb'
                                    }`,
                                  }}
                                >
                                  {ris}
                                </span>
                                <span style={{ fontSize: '18px' }}>{l.passato ? '✅' : '☐'}</span>
                                <span
                                  style={{
                                    fontWeight: '600',
                                    fontSize: '0.85rem',
                                    color: l.passato ? liv.colore : '#dc2626',
                                  }}
                                >
                                  {l.passato ? 'Passato' : 'Non passato'}
                                </span>
                                {l.note && (
                                  <span style={{ color: '#666', fontStyle: 'italic', fontSize: '0.82rem' }}>
                                    📝 {l.note}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export default CheckListGlucometro;
