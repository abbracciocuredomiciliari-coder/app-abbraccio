import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';

interface CheckListEntry {
  _id: string;
  data: string;
  nSerieAED: string;
  ubicazioneAED: string;
  unitaAccessoriNonDanneggiati: boolean;
  batterieElettrodiScortaNonScaduti: boolean;
  asiLampeggiaVerde: boolean;
  commenti: string;
  ispezionatoDa: string;
  createdAt: string;
}

const vociChecklist = [
  {
    key: 'unitaAccessoriNonDanneggiati' as const,
    label: "Controllare che l'unità e gli accessori non siano danneggiati, sporchi o contaminati. Pulire o sostituire se necessario",
  },
  {
    key: 'batterieElettrodiScortaNonScaduti' as const,
    label: 'Controllare che i pacchi batteria e gli elettrodi di scorta non siano scaduti',
  },
  {
    key: 'asiLampeggiaVerde' as const,
    label: "Controllare che l'ASI lampeggi verde",
  },
];

const oggiISO = () => new Date().toISOString().substring(0, 10);

function CheckList() {
  const { user } = useAuth();
  const [storico, setStorico] = useState<CheckListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mostraForm, setMostraForm] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    data: oggiISO(),
    nSerieAED: '',
    ubicazioneAED: '',
    unitaAccessoriNonDanneggiati: false,
    batterieElettrodiScortaNonScaduti: false,
    asiLampeggiaVerde: false,
    commenti: '',
    ispezionatoDa: '',
  });

  useEffect(() => {
    fetchStorico();
  }, []);

  const fetchStorico = async () => {
    try {
      const res = await api.get('/checklist-defibrillatore');
      setStorico(res.data);
    } catch (err) {
      console.warn('Errore nel caricamento dello storico checklist:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      data: oggiISO(),
      nSerieAED: '',
      ubicazioneAED: '',
      unitaAccessoriNonDanneggiati: false,
      batterieElettrodiScortaNonScaduti: false,
      asiLampeggiaVerde: false,
      commenti: '',
      ispezionatoDa: user?.name || '',
    });
  };

  const apriForm = () => {
    resetForm();
    setMostraForm(true);
  };

  const salvaChecklist = async () => {
    if (!form.ispezionatoDa.trim()) {
      alert('Il campo "Ispezionato da" è obbligatorio');
      return;
    }
    setSalvando(true);
    try {
      const res = await api.post('/checklist-defibrillatore', form);
      setStorico([res.data, ...storico]);
      setMostraForm(false);
      setSuccess('Checklist salvata con successo!');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Errore nel salvataggio');
    } finally {
      setSalvando(false);
    }
  };

  const eliminaChecklist = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa checklist?')) return;
    try {
      await api.delete(`/checklist-defibrillatore/${id}`);
      setStorico(storico.filter((c) => c._id !== id));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Errore durante l\'eliminazione');
    }
  };

  const formatData = (data: string) => {
    if (!data) return 'N/A';
    return new Date(data).toLocaleDateString('it-IT');
  };

  const tutteSpuntate = (entry: CheckListEntry) =>
    entry.unitaAccessoriNonDanneggiati &&
    entry.batterieElettrodiScortaNonScaduti &&
    entry.asiLampeggiaVerde;

  // Stampa report completo di tutti i controlli in un unico PDF
  const stampaPDFReport = () => {
    if (storico.length === 0) {
      alert('Nessuna checklist da stampare.');
      return;
    }
    const oggi = new Date().toLocaleDateString('it-IT');

    const righe = storico.map((entry) => {
      const ok = tutteSpuntate(entry);
      const data = new Date(entry.data).toLocaleDateString('it-IT');
      const vociOk = vociChecklist.filter((v) => entry[v.key]).length;
      const esito = ok
        ? `<span style="color:#155724;font-weight:bold;">✅ Completa (3/3)</span>`
        : `<span style="color:#856404;font-weight:bold;">⚠️ Parziale (${vociOk}/3)</span>`;

      const dettaglioVoci = vociChecklist.map((v) => {
        const spuntata = entry[v.key];
        return `<div style="font-size:11px;color:${spuntata ? '#155724' : '#721c24'};margin-top:2px;">
          ${spuntata ? '✅' : '☐'} ${v.label}
        </div>`;
      }).join('');

      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #ddd;white-space:nowrap;">${data}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #ddd;">${entry.nSerieAED || '—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #ddd;">${entry.ubicazioneAED || '—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #ddd;">${esito}${dettaglioVoci}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #ddd;">${entry.ispezionatoDa}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #ddd;font-style:italic;color:#666;">${entry.commenti || '—'}</td>
      </tr>`;
    }).join('');

    const totale = storico.length;
    const complete = storico.filter(tutteSpuntate).length;
    const parziali = totale - complete;

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <title>Report Completo Checklist Defibrillatore</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #222; font-size: 12px; }
    .intestazione { display: flex; align-items: center; gap: 20px; border-bottom: 3px solid #1e4d8c; padding-bottom: 14px; margin-bottom: 18px; }
    .intestazione img { height: 70px; width: auto; }
    .intestazione .testo h1 { margin: 0; font-size: 18px; color: #1e4d8c; }
    .intestazione .testo p { margin: 3px 0 0; font-size: 11px; color: #666; }
    .riepilogo { display: flex; gap: 20px; margin-bottom: 18px; flex-wrap: wrap; }
    .stat { background: #f5f8fc; border: 1px solid #d0dff0; border-radius: 6px; padding: 10px 18px; text-align: center; }
    .stat .num { font-size: 22px; font-weight: bold; color: #1e4d8c; }
    .stat .lab { font-size: 11px; color: #666; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #1e4d8c; color: #fff; padding: 8px 10px; text-align: left; }
    td { vertical-align: top; }
    tr:nth-child(even) td { background: #f5f8fc; }
    .footer { margin-top: 20px; font-size: 10px; color: #888; border-top: 1px solid #ddd; padding-top: 8px; }
    @media print { body { margin: 8mm; } }
  </style>
</head>
<body>
  <div class="intestazione">
    <img src="${window.location.origin}/logo.png" alt="Abbraccio Cure Domiciliari" onerror="this.style.display='none'" />
    <div class="testo">
      <h1>📋 Report Completo — Checklist Defibrillatore</h1>
      <p>Abbraccio Cure Domiciliari — Documento generato il ${oggi} — Totale controlli: ${totale}</p>
    </div>
  </div>
  <div class="riepilogo">
    <div class="stat"><div class="num">${totale}</div><div class="lab">Controlli totali</div></div>
    <div class="stat" style="border-color:#28a745;"><div class="num" style="color:#28a745;">${complete}</div><div class="lab">✅ Completi</div></div>
    <div class="stat" style="border-color:#ffc107;"><div class="num" style="color:#856404;">${parziali}</div><div class="lab">⚠️ Parziali</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>N° Serie AED</th>
        <th>Ubicazione</th>
        <th>Esito / Voci</th>
        <th>Operatore</th>
        <th>Commenti</th>
      </tr>
    </thead>
    <tbody>${righe}</tbody>
  </table>
  <div class="footer">Documento generato automaticamente da Abbraccio Cure Domiciliari — Lista operativa DAC-510E-IT Rev. G, Sez. 5.6</div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.focus();
    }
  };

  const generaHTMLChecklist = (entry: CheckListEntry): string => {
    const oggi = new Date(entry.data).toLocaleDateString('it-IT');
    const voci = vociChecklist
      .map((v) => {
        const ok = entry[v.key];
        return `<tr>
          <td style="padding:8px 10px;border-bottom:1px solid #ddd;">${v.label}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #ddd;text-align:center;font-size:18px;">${ok ? '✅' : '☐'}</td>
        </tr>`;
      })
      .join('');

    return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <title>Checklist Defibrillatore — ${oggi}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #222; }
    .intestazione { display: flex; align-items: center; gap: 20px; border-bottom: 3px solid #1e4d8c; padding-bottom: 14px; margin-bottom: 18px; }
    .intestazione img { height: 70px; width: auto; }
    .intestazione .testo h1 { margin: 0; font-size: 20px; color: #1e4d8c; }
    .intestazione .testo p { margin: 3px 0 0; font-size: 12px; color: #666; }
    .info-box { background: #f5f8fc; border: 1px solid #d0dff0; border-radius: 6px; padding: 12px 16px; margin-bottom: 18px; font-size: 13px; }
    .info-box strong { color: #1e4d8c; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 18px; }
    th { background: #1e4d8c; color: #fff; padding: 8px 10px; text-align: left; }
    td { vertical-align: middle; }
    .commenti { background: #fffbe6; border: 1px solid #ffe58f; border-radius: 6px; padding: 10px 14px; font-size: 13px; margin-bottom: 14px; }
    .firma { margin-top: 30px; font-size: 13px; border-top: 1px solid #ddd; padding-top: 12px; }
    .footer { margin-top: 20px; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 8px; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <div class="intestazione">
    <img src="${window.location.origin}/logo.png" alt="Abbraccio Cure Domiciliari" onerror="this.style.display='none'" />
    <div class="testo">
      <h1>💚 Lista Operativa di Controllo — Defibtech LIFELINE AED</h1>
      <p>Abbraccio Cure Domiciliari — DAC-510E-IT Rev. G — Sez. 5.6</p>
    </div>
  </div>
  <div class="info-box">
    <strong>Data:</strong> ${oggi} &nbsp;&nbsp;
    <strong>N° di serie LIFELINE AED:</strong> ${entry.nSerieAED || '___________________________'} &nbsp;&nbsp;
    <strong>Ubicazione:</strong> ${entry.ubicazioneAED || '___________________________'}
  </div>
  <table>
    <thead>
      <tr>
        <th>Voce di controllo</th>
        <th style="width:80px;text-align:center;">Eseguito</th>
      </tr>
    </thead>
    <tbody>${voci}</tbody>
  </table>
  ${entry.commenti ? `<div class="commenti"><strong>Commenti:</strong> ${entry.commenti}</div>` : ''}
  <div class="firma">
    <strong>Ispezionato da:</strong> ${entry.ispezionatoDa}
  </div>
  <div class="footer">Documento generato automaticamente da Abbraccio Cure Domiciliari</div>
</body>
</html>`;
  };

  const visualizzaChecklist = (entry: CheckListEntry) => {
    const html = generaHTMLChecklist(entry);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
    }
  };

  const stampaChecklist = (entry: CheckListEntry) => {
    const html = generaHTMLChecklist(entry);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    }
  };

  const tutteVociForm =
    form.unitaAccessoriNonDanneggiati &&
    form.batterieElettrodiScortaNonScaduti &&
    form.asiLampeggiaVerde;

  return (
    <section>
      <h2>📋 Check List Defibrillatore</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: '24px', fontSize: '0.95rem' }}>
        Lista operativa di controllo giornaliera — Defibtech LIFELINE AED (DAC-510E-IT Rev. G, Sez. 5.6)
      </p>

      {/* Pulsante nuova checklist */}
      {!mostraForm && (
        <button
          type="button"
          onClick={apriForm}
          style={{ background: '#1e4d8c', marginBottom: '28px', fontSize: '1rem', padding: '10px 22px' }}
        >
          ➕ Nuova checklist giornaliera
        </button>
      )}

      {/* Form compilazione */}
      {mostraForm && (
        <div
          className="dashboard-folder"
          style={{ marginBottom: '32px', border: '2px solid #1e4d8c', borderRadius: '10px', padding: '24px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#1e4d8c' }}>📝 Nuova Checklist — {new Date(form.data).toLocaleDateString('it-IT')}</h3>
            <button
              type="button"
              onClick={() => setMostraForm(false)}
              style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
            >
              ×
            </button>
          </div>

          {/* Dati identificativi */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Data *</span>
              <input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
                style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>N° di serie LIFELINE AED</span>
              <input
                type="text"
                value={form.nSerieAED}
                onChange={(e) => setForm({ ...form, nSerieAED: e.target.value })}
                placeholder="Es. AED-2024-001"
                style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Ubicazione LIFELINE AED</span>
              <input
                type="text"
                value={form.ubicazioneAED}
                onChange={(e) => setForm({ ...form, ubicazioneAED: e.target.value })}
                placeholder="Es. Ingresso principale"
                style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }}
              />
            </label>
          </div>

          {/* Voci di controllo */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '14px', color: '#1e4d8c' }}>Voci di controllo</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {vociChecklist.map((voce) => {
                const checked = form[voce.key];
                return (
                  <label
                    key={voce.key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: `1px solid ${checked ? '#28a745' : '#dee2e6'}`,
                      background: checked ? 'rgba(40,167,69,0.06)' : '#fafafa',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setForm({ ...form, [voce.key]: e.target.checked })}
                      style={{ width: '18px', height: '18px', marginTop: '2px', flexShrink: 0, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.95rem', lineHeight: '1.5', color: checked ? '#155724' : '#333', fontWeight: checked ? '600' : '400' }}>
                      {checked ? '✅ ' : '☐ '}{voce.label}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Indicatore stato */}
            <div
              style={{
                marginTop: '16px',
                padding: '10px 16px',
                borderRadius: '6px',
                background: tutteVociForm ? 'rgba(40,167,69,0.1)' : 'rgba(220,53,69,0.08)',
                border: `1px solid ${tutteVociForm ? '#28a745' : '#dc3545'}`,
                color: tutteVociForm ? '#155724' : '#721c24',
                fontWeight: '600',
                fontSize: '0.9rem',
              }}
            >
              {tutteVociForm
                ? '✅ Tutte le voci di controllo sono state completate'
                : `⚠️ ${vociChecklist.filter((v) => !form[v.key]).length} voce/i ancora da spuntare`}
            </div>
          </div>

          {/* Commenti e firma */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Commenti</span>
              <textarea
                value={form.commenti}
                onChange={(e) => setForm({ ...form, commenti: e.target.value })}
                placeholder="Note aggiuntive..."
                rows={3}
                style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px', resize: 'vertical' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Ispezionato da (iniziali o firma) *</span>
              <input
                type="text"
                value={form.ispezionatoDa}
                onChange={(e) => setForm({ ...form, ispezionatoDa: e.target.value })}
                placeholder="Es. M.R. o Mario Rossi"
                style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }}
              />
            </label>
          </div>

          {/* Pulsanti azione */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={salvaChecklist}
              disabled={salvando}
              style={{ background: '#28a745', padding: '10px 24px', fontSize: '15px', opacity: salvando ? 0.7 : 1 }}
            >
              {salvando ? '⏳ Salvataggio...' : '💾 Salva checklist'}
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

      {/* Storico checklist */}
      <div className="dashboard-folder">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>📂 Storico checklist compilate</h3>
          {storico.length > 0 && (
            <button
              type="button"
              onClick={stampaPDFReport}
              style={{ background: '#6c757d', fontSize: '0.85rem', padding: '7px 16px' }}
            >
              🖨️ Stampa report completo PDF
            </button>
          )}
        </div>

        {loading ? (
          <p>Caricamento...</p>
        ) : storico.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>Nessuna checklist compilata. Clicca "Nuova checklist giornaliera" per iniziare.</p>
        ) : (
          <div className="document-list">
            <ul>
              {storico.map((entry) => {
                const ok = tutteSpuntate(entry);
                const vociOk = vociChecklist.filter((v) => entry[v.key]).length;
                return (
                  <li key={entry._id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <strong style={{ fontSize: '1rem' }}>
                          {new Date(entry.data).toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </strong>
                        <div style={{ marginTop: '4px', fontSize: '0.88rem', color: '#555', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                          {entry.nSerieAED && <span>🔢 N° serie: <strong>{entry.nSerieAED}</strong></span>}
                          {entry.ubicazioneAED && <span>📍 {entry.ubicazioneAED}</span>}
                          <span>👤 {entry.ispezionatoDa}</span>
                          <span
                            style={{
                              fontWeight: '700',
                              color: ok ? '#155724' : '#856404',
                              background: ok ? 'rgba(40,167,69,0.1)' : 'rgba(255,193,7,0.15)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: `1px solid ${ok ? '#28a745' : '#ffc107'}`,
                            }}
                          >
                            {ok ? '✅ Completa' : `⚠️ ${vociOk}/3 voci`}
                          </span>
                        </div>
                        {entry.commenti && (
                          <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
                            💬 {entry.commenti}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => visualizzaChecklist(entry)}
                          style={{ background: '#3b82f6', fontSize: '0.85rem', padding: '6px 14px' }}
                        >
                          👁️ Visualizza PDF
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

export default CheckList;
