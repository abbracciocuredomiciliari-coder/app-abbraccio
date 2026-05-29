import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface RegistroIntervento {
  data: string;
  tipoIntervento: string;
  esito: 'Ok' | 'Ko';
  firma: string;
}

interface SchedaEntry {
  _id: string;
  apparecchio: string;
  idSN: string;
  registroInterventi: RegistroIntervento[];
  integritaCaviAlimentazione: boolean;
  integritaCaviAlimentazioneNote: string;
  correttoAvvioAutoTest: boolean;
  correttoAvvioAutoTestNote: string;
  puliziaScocca: boolean;
  puliziaScoccanote: string;
  batteriaCarica: boolean;
  batteriaCaricaNote: string;
  compilatoDa: string;
  dataCompilazione: string;
  createdAt: string;
}

// ─── Voci checklist verifica prima dell'uso ───────────────────────────────────

const vociChecklist: {
  key: 'integritaCaviAlimentazione' | 'correttoAvvioAutoTest' | 'puliziaScocca' | 'batteriaCarica';
  noteKey: 'integritaCaviAlimentazioneNote' | 'correttoAvvioAutoTestNote' | 'puliziaScoccanote' | 'batteriaCaricaNote';
  label: string;
}[] = [
  {
    key: 'integritaCaviAlimentazione',
    noteKey: 'integritaCaviAlimentazioneNote',
    label: 'Integrità cavi di alimentazione',
  },
  {
    key: 'correttoAvvioAutoTest',
    noteKey: 'correttoAvvioAutoTestNote',
    label: 'Corretto avvio e auto-test',
  },
  {
    key: 'puliziaScocca',
    noteKey: 'puliziaScoccanote',
    label: 'Pulizia scocca esterna',
  },
  {
    key: 'batteriaCarica',
    noteKey: 'batteriaCaricaNote',
    label: 'Batteria carica',
  },
];

// ─── Stato iniziale form ──────────────────────────────────────────────────────

const oggiISO = () => new Date().toISOString().substring(0, 10);

const formVuoto = (nome = '') => ({
  apparecchio: '',
  idSN: '',
  dataCompilazione: oggiISO(),
  compilatoDa: nome,
  // Registro interventi
  registroInterventi: [{ data: oggiISO(), tipoIntervento: '', esito: 'Ok' as 'Ok' | 'Ko', firma: '' }],
  // Checklist
  integritaCaviAlimentazione: false,
  integritaCaviAlimentazioneNote: '',
  correttoAvvioAutoTest: false,
  correttoAvvioAutoTestNote: '',
  puliziaScocca: false,
  puliziaScoccanote: '',
  batteriaCarica: false,
  batteriaCaricaNote: '',
});

// ─── Componente principale ────────────────────────────────────────────────────

function SchedaControlloDefibrillatore() {
  const { user } = useAuth();
  const [storico, setStorico] = useState<SchedaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mostraForm, setMostraForm] = useState(false);
  const [schedaAperta, setSchedaAperta] = useState<string | null>(null);

  const [form, setForm] = useState(formVuoto(user?.name || ''));

  useEffect(() => {
    fetchStorico();
  }, []);

  const fetchStorico = async () => {
    try {
      const res = await api.get('/scheda-controllo-defibrillatore');
      setStorico(res.data);
    } catch (err) {
      console.warn('Errore nel caricamento delle schede:', err);
    } finally {
      setLoading(false);
    }
  };

  const apriForm = () => {
    setForm(formVuoto(user?.name || ''));
    setMostraForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Gestione righe registro interventi ──────────────────────────────────────

  const aggiungiRiga = () => {
    setForm({
      ...form,
      registroInterventi: [
        ...form.registroInterventi,
        { data: oggiISO(), tipoIntervento: '', esito: 'Ok', firma: '' },
      ],
    });
  };

  const rimuoviRiga = (idx: number) => {
    setForm({
      ...form,
      registroInterventi: form.registroInterventi.filter((_, i) => i !== idx),
    });
  };

  const aggiornaRiga = (idx: number, campo: keyof RegistroIntervento, valore: string) => {
    const nuove = form.registroInterventi.map((r, i) =>
      i === idx ? { ...r, [campo]: valore } : r
    );
    setForm({ ...form, registroInterventi: nuove });
  };

  // ─── Salvataggio ─────────────────────────────────────────────────────────────

  const salvaScheda = async () => {
    if (!form.compilatoDa.trim()) {
      alert('Il campo "Compilato da" è obbligatorio');
      return;
    }
    if (!form.dataCompilazione) {
      alert('La data di compilazione è obbligatoria');
      return;
    }
    setSalvando(true);
    try {
      const res = await api.post('/scheda-controllo-defibrillatore', form);
      setStorico([res.data, ...storico]);
      setMostraForm(false);
      alert('Scheda salvata con successo!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel salvataggio');
    } finally {
      setSalvando(false);
    }
  };

  const eliminaScheda = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa scheda?')) return;
    try {
      await api.delete(`/scheda-controllo-defibrillatore/${id}`);
      setStorico(storico.filter((s) => s._id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.message || "Errore durante l'eliminazione");
    }
  };

  // ─── Visualizza PDF ───────────────────────────────────────────────────────────────

  const stampaScheda = (entry: SchedaEntry) => {
    const dataComp = new Date(entry.dataCompilazione).toLocaleDateString('it-IT');

    const righeRegistro = entry.registroInterventi.length > 0
      ? entry.registroInterventi
          .map(
            (r) => `<tr>
          <td style="padding:7px 10px;border:1px solid #ccc;">${new Date(r.data).toLocaleDateString('it-IT')}</td>
          <td style="padding:7px 10px;border:1px solid #ccc;">${r.tipoIntervento || '—'}</td>
          <td style="padding:7px 10px;border:1px solid #ccc;text-align:center;font-weight:700;color:${r.esito === 'Ok' ? '#155724' : '#721c24'};">${r.esito}</td>
          <td style="padding:7px 10px;border:1px solid #ccc;">${r.firma || '—'}</td>
        </tr>`
          )
          .join('')
      : `<tr><td colspan="4" style="padding:10px;border:1px solid #ccc;color:#888;font-style:italic;text-align:center;">Nessun intervento registrato</td></tr>`;

    const righeChecklist = vociChecklist
      .map((v) => {
        const ok = entry[v.key];
        const nota = entry[v.noteKey];
        return `<tr>
          <td style="padding:8px 10px;border:1px solid #ccc;">${v.label}</td>
          <td style="padding:8px 10px;border:1px solid #ccc;text-align:center;font-size:17px;">${ok ? '✅' : '☐'}</td>
          <td style="padding:8px 10px;border:1px solid #ccc;color:#555;font-size:12px;">${nota || ''}</td>
        </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <title>Scheda Controllo Defibrillatore — ${dataComp}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #222; font-size: 13px; }
    .intestazione { display: flex; align-items: center; gap: 20px; border-bottom: 3px solid #1e4d8c; padding-bottom: 14px; margin-bottom: 18px; }
    .intestazione img { height: 70px; width: auto; }
    .intestazione .testo h1 { margin: 0; font-size: 18px; color: #1e4d8c; }
    .intestazione .testo p { margin: 3px 0 0; font-size: 11px; color: #666; }
    .info-box { background: #f5f8fc; border: 1px solid #d0dff0; border-radius: 6px; padding: 10px 16px; margin-bottom: 16px; }
    .info-box strong { color: #1e4d8c; }
    h2 { font-size: 14px; color: #1e4d8c; margin: 18px 0 8px; border-bottom: 1px solid #d0dff0; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
    th { background: #1e4d8c; color: #fff; padding: 7px 10px; text-align: left; }
    td { vertical-align: middle; }
    .firma-box { margin-top: 24px; border-top: 1px solid #ddd; padding-top: 12px; }
    .footer { margin-top: 16px; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 6px; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <div class="intestazione">
    <img src="${window.location.origin}/logo.png" alt="Abbraccio Cure Domiciliari" onerror="this.style.display='none'" />
    <div class="testo">
      <h1>🫀 Scheda di Controllo Periodico Apparecchiature</h1>
      <p>Procedura Manutenzione Apparecchiature — Rev. 01/2026 — Abbraccio Cure Domiciliari</p>
    </div>
  </div>

  <div class="info-box">
    <strong>Apparecchio:</strong> ${entry.apparecchio || '____________________'} &nbsp;&nbsp;
    <strong>ID/SN:</strong> ${entry.idSN || '____________________'} &nbsp;&nbsp;
    <strong>Data compilazione:</strong> ${dataComp}
  </div>

  <h2>📋 Registro Interventi e Controlli</h2>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Tipo Intervento</th>
        <th style="width:80px;text-align:center;">Esito (Ok/Ko)</th>
        <th>Firma</th>
      </tr>
    </thead>
    <tbody>${righeRegistro}</tbody>
  </table>

  <h2>✅ Checklist Verifica Prima dell'Uso</h2>
  <table>
    <thead>
      <tr>
        <th>Controllo Visivo/Funzionale</th>
        <th style="width:70px;text-align:center;">Esito</th>
        <th style="width:200px;">Note</th>
      </tr>
    </thead>
    <tbody>${righeChecklist}</tbody>
  </table>

  <div class="firma-box">
    <strong>Compilato da:</strong> ${entry.compilatoDa}
  </div>
  <div class="footer">Documento generato automaticamente da Abbraccio Cure Domiciliari</div>
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

  // ─── Calcoli stato ────────────────────────────────────────────────────────────

  const tutteVociForm =
    form.integritaCaviAlimentazione &&
    form.correttoAvvioAutoTest &&
    form.puliziaScocca &&
    form.batteriaCarica;

  const tutteVociEntry = (e: SchedaEntry) =>
    e.integritaCaviAlimentazione &&
    e.correttoAvvioAutoTest &&
    e.puliziaScocca &&
    e.batteriaCarica;

  const vociOkEntry = (e: SchedaEntry) =>
    vociChecklist.filter((v) => e[v.key]).length;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <section>
      <h2>🫀 Scheda Controllo Apparecchiature Elettromedicali</h2>
      <p style={{ color: 'var(--gray-500)', marginBottom: '24px', fontSize: '0.95rem' }}>
        Scheda di Controllo Periodico Apparecchiature — Procedura Manutenzione Rev. 01/2026
      </p>

      {/* Pulsante nuova scheda */}
      {!mostraForm && (
        <button
          type="button"
          onClick={apriForm}
          style={{ background: '#1e4d8c', marginBottom: '28px', fontSize: '1rem', padding: '10px 22px' }}
        >
          ➕ Nuova scheda di controllo
        </button>
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
              📝 Nuova Scheda — {new Date(form.dataCompilazione).toLocaleDateString('it-IT')}
            </h3>
            <button
              type="button"
              onClick={() => setMostraForm(false)}
              style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
            >
              ×
            </button>
          </div>

          {/* Dati identificativi apparecchio */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Data compilazione *</span>
              <input
                type="date"
                value={form.dataCompilazione}
                onChange={(e) => setForm({ ...form, dataCompilazione: e.target.value })}
                style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Apparecchio</span>
              <input
                type="text"
                value={form.apparecchio}
                onChange={(e) => setForm({ ...form, apparecchio: e.target.value })}
                placeholder="Es. Defibrillatore AED"
                style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>ID / N° Serie</span>
              <input
                type="text"
                value={form.idSN}
                onChange={(e) => setForm({ ...form, idSN: e.target.value })}
                placeholder="Es. SN-2024-001"
                style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Compilato da *</span>
              <input
                type="text"
                value={form.compilatoDa}
                onChange={(e) => setForm({ ...form, compilatoDa: e.target.value })}
                placeholder="Es. Mario Rossi"
                style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }}
              />
            </label>
          </div>

          {/* ─── Registro Interventi e Controlli ─────────────────────────────── */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, color: '#1e4d8c' }}>📋 Registro Interventi e Controlli</h4>
              <button
                type="button"
                onClick={aggiungiRiga}
                style={{ background: '#1e4d8c', fontSize: '0.82rem', padding: '5px 14px' }}
              >
                ➕ Aggiungi riga
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#1e4d8c', color: '#fff' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '130px' }}>Data</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '200px' }}>Tipo Intervento</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', minWidth: '100px' }}>Esito (Ok/Ko)</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: '150px' }}>Firma</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.registroInterventi.map((riga, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#f9fbff' : '#fff' }}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e9ecef' }}>
                        <input
                          type="date"
                          value={riga.data}
                          onChange={(e) => aggiornaRiga(idx, 'data', e.target.value)}
                          style={{ padding: '5px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px', width: '100%' }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e9ecef' }}>
                        <input
                          type="text"
                          value={riga.tipoIntervento}
                          onChange={(e) => aggiornaRiga(idx, 'tipoIntervento', e.target.value)}
                          placeholder="Es. Controllo periodico"
                          style={{ padding: '5px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px', width: '100%' }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e9ecef', textAlign: 'center' }}>
                        <select
                          value={riga.esito}
                          onChange={(e) => aggiornaRiga(idx, 'esito', e.target.value)}
                          style={{
                            padding: '5px 8px',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontWeight: '700',
                            color: riga.esito === 'Ok' ? '#155724' : '#721c24',
                            background: riga.esito === 'Ok' ? 'rgba(40,167,69,0.08)' : 'rgba(220,53,69,0.08)',
                          }}
                        >
                          <option value="Ok">Ok</option>
                          <option value="Ko">Ko</option>
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e9ecef' }}>
                        <input
                          type="text"
                          value={riga.firma}
                          onChange={(e) => aggiornaRiga(idx, 'firma', e.target.value)}
                          placeholder="Firma / Iniziali"
                          style={{ padding: '5px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '13px', width: '100%' }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #e9ecef', textAlign: 'center' }}>
                        {form.registroInterventi.length > 1 && (
                          <button
                            type="button"
                            onClick={() => rimuoviRiga(idx)}
                            style={{ background: '#dc3545', fontSize: '0.75rem', padding: '3px 8px', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Checklist Verifica Prima dell'Uso ───────────────────────────── */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ marginBottom: '14px', color: '#1e4d8c' }}>✅ Checklist Verifica Prima dell'Uso</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {vociChecklist.map((voce) => {
                const checked = form[voce.key];
                return (
                  <div
                    key={voce.key}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: `1px solid ${checked ? '#28a745' : '#dee2e6'}`,
                      background: checked ? 'rgba(40,167,69,0.06)' : '#fafafa',
                      transition: 'all 0.15s',
                    }}
                  >
                    {/* Checkbox + label */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', gridColumn: '1 / 2' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => setForm({ ...form, [voce.key]: e.target.checked })}
                        style={{ width: '18px', height: '18px', flexShrink: 0, cursor: 'pointer' }}
                      />
                      <span
                        style={{
                          fontSize: '0.93rem',
                          lineHeight: '1.4',
                          color: checked ? '#155724' : '#333',
                          fontWeight: checked ? '600' : '400',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {checked ? '✅ ' : '☐ '}{voce.label}
                      </span>
                    </label>

                    {/* Campo note */}
                    <input
                      type="text"
                      value={form[voce.noteKey]}
                      onChange={(e) => setForm({ ...form, [voce.noteKey]: e.target.value })}
                      placeholder="Note..."
                      style={{
                        padding: '6px 10px',
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        fontSize: '13px',
                        gridColumn: '2 / 4',
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Indicatore stato checklist */}
            <div
              style={{
                marginTop: '14px',
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

          {/* Pulsanti azione */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={salvaScheda}
              disabled={salvando}
              style={{ background: '#28a745', padding: '10px 24px', fontSize: '15px', opacity: salvando ? 0.7 : 1 }}
            >
              {salvando ? '⏳ Salvataggio...' : '💾 Salva scheda'}
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

      {/* ─── Storico schede ──────────────────────────────────────────────────── */}
      <div className="dashboard-folder">
        <h3>📂 Storico schede compilate</h3>

        {loading ? (
          <p>Caricamento...</p>
        ) : storico.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>
            Nessuna scheda compilata. Clicca "Nuova scheda di controllo" per iniziare.
          </p>
        ) : (
          <div className="document-list">
            <ul>
              {storico.map((entry) => {
                const ok = tutteVociEntry(entry);
                const nOk = vociOkEntry(entry);
                const aperta = schedaAperta === entry._id;

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
                          {new Date(entry.dataCompilazione).toLocaleDateString('it-IT', {
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
                          {entry.apparecchio && (
                            <span>
                              🔧 <strong>{entry.apparecchio}</strong>
                            </span>
                          )}
                          {entry.idSN && <span>🔢 ID: {entry.idSN}</span>}
                          <span>👤 {entry.compilatoDa}</span>
                          {entry.registroInterventi.length > 0 && (
                            <span>📋 {entry.registroInterventi.length} intervento/i</span>
                          )}
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
                            {ok ? '✅ Completa' : `⚠️ ${nOk}/4 voci`}
                          </span>
                        </div>
                      </div>

                      {/* Pulsanti */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setSchedaAperta(aperta ? null : entry._id)}
                          style={{ background: '#6c757d', fontSize: '0.85rem', padding: '6px 14px' }}
                        >
                          {aperta ? '▲ Chiudi' : '▼ Dettagli'}
                        </button>
                        <button
                          type="button"
                          onClick={() => stampaScheda(entry)}
                          style={{ background: '#1e4d8c', fontSize: '0.85rem', padding: '6px 14px' }}
                        >
                          🖨️ Visualizza PDF
                        </button>
                        {user && (user.role === 'admin' || user.role === 'coordinator') && (
                          <button
                            type="button"
                            onClick={() => eliminaScheda(entry._id)}
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
                          marginTop: '16px',
                          padding: '16px',
                          background: '#f8f9fa',
                          borderRadius: '8px',
                          border: '1px solid #dee2e6',
                        }}
                      >
                        {/* Registro interventi */}
                        {entry.registroInterventi.length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <strong style={{ color: '#1e4d8c', fontSize: '0.9rem' }}>
                              📋 Registro Interventi e Controlli
                            </strong>
                            <div style={{ overflowX: 'auto', marginTop: '8px' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                  <tr style={{ background: '#1e4d8c', color: '#fff' }}>
                                    <th style={{ padding: '6px 10px', textAlign: 'left' }}>Data</th>
                                    <th style={{ padding: '6px 10px', textAlign: 'left' }}>Tipo Intervento</th>
                                    <th style={{ padding: '6px 10px', textAlign: 'center' }}>Esito</th>
                                    <th style={{ padding: '6px 10px', textAlign: 'left' }}>Firma</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {entry.registroInterventi.map((r, i) => (
                                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f1f3f5' }}>
                                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #dee2e6' }}>
                                        {new Date(r.data).toLocaleDateString('it-IT')}
                                      </td>
                                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #dee2e6' }}>
                                        {r.tipoIntervento || '—'}
                                      </td>
                                      <td
                                        style={{
                                          padding: '6px 10px',
                                          borderBottom: '1px solid #dee2e6',
                                          textAlign: 'center',
                                          fontWeight: '700',
                                          color: r.esito === 'Ok' ? '#155724' : '#721c24',
                                        }}
                                      >
                                        {r.esito}
                                      </td>
                                      <td style={{ padding: '6px 10px', borderBottom: '1px solid #dee2e6' }}>
                                        {r.firma || '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Checklist verifica */}
                        <div>
                          <strong style={{ color: '#1e4d8c', fontSize: '0.9rem' }}>
                            ✅ Checklist Verifica Prima dell'Uso
                          </strong>
                          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {vociChecklist.map((v) => {
                              const esito = entry[v.key];
                              const nota = entry[v.noteKey];
                              return (
                                <div
                                  key={v.key}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '6px 10px',
                                    borderRadius: '5px',
                                    background: esito ? 'rgba(40,167,69,0.07)' : 'rgba(220,53,69,0.05)',
                                    border: `1px solid ${esito ? '#c3e6cb' : '#f5c6cb'}`,
                                    fontSize: '0.87rem',
                                  }}
                                >
                                  <span style={{ fontSize: '16px' }}>{esito ? '✅' : '☐'}</span>
                                  <span style={{ flex: 1, color: esito ? '#155724' : '#721c24', fontWeight: esito ? '600' : '400' }}>
                                    {v.label}
                                  </span>
                                  {nota && (
                                    <span style={{ color: '#666', fontStyle: 'italic', fontSize: '0.82rem' }}>
                                      📝 {nota}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
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

export default SchedaControlloDefibrillatore;
