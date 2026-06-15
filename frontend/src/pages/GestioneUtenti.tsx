import { useEffect, useState } from 'react';
import api from '../api/api';
import { Button } from '../components/ui/Button';

interface Utente {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected';
  professione?: string;
  categoria?: string;
  createdAt: string;
  domicilioPartenza?: string;
  raggioAzioneKm?: number;
  domicilioCoords?: { lat: number; lng: number };
  firmaContratto?: string;
}

interface UtenteDettaglio extends Utente {
  telefono?: string;
  codiceFiscale?: string;
  dataNascita?: string;
  luogoNascita?: string;
  indirizzoResidenza?: string;
  pec?: string;
  tipoCollaborazione?: string;
  partitaIva?: string;
  regimeFiscale?: string;
  ordineAlbo?: string;
  numeroAlbo?: string;
  firmaContratto?: string;
  dataFirmaContratto?: string;
  luogoFirmaContratto?: string;
  contrattoPdfUrl?: string;
  autoveicoli?: string;
  documenti?: {
    assicurazione?: string;
    documentoIdentita?: string;
    attestazioneQualifica?: string;
  };
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  coordinator: 'Coordinatore',
  caregiver: 'Operatore',
  direttore: 'Direttore Sanitario',
  paziente_registrato: 'Paziente / Caregiver',
};

const statusColors: Record<string, { bg: string; border: string; color: string; label: string }> = {
  pending:  { bg: 'rgba(245,158,11,0.1)',  border: '#f59e0b', color: '#92400e', label: '⏳ In attesa' },
  approved: { bg: 'rgba(5,150,105,0.1)',   border: '#059669', color: '#065f46', label: '✅ Approvato' },
  rejected: { bg: 'rgba(220,38,38,0.1)',   border: '#dc2626', color: '#7f1d1d', label: '❌ Rifiutato' },
};

const categoriaLabels: Record<string, string> = {
  infermieristico: 'Infermieristico',
  oss: 'OSS',
  riabilitativo: 'Riabilitativo',
  medico: 'Medico',
  coordinamento: 'Coordinamento',
  direzione: 'Direzione',
};

function GestioneUtenti() {
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'tutti' | 'pending' | 'rejected'>('pending');
  const [approvandoId, setApprovandoId] = useState<string | null>(null);
  const [loadingPdfUserId, setLoadingPdfUserId] = useState<string | null>(null);
  const [roleSelezionato, setRoleSelezionato] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null);
  const [conferma, setConferma] = useState<{ msg: string; onSi: () => void } | null>(null);

  const mostraToast = (msg: string, tipo: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  const apriPdfContratto = async (userId: string) => {
    setLoadingPdfUserId(userId);
    try {
      const res = await api.get(`/contratto/pdf/${userId}`);
      const html = res.data;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (w) w.onload = () => URL.revokeObjectURL(url);
    } catch (err: any) {
      mostraToast(err?.response?.data?.message || 'Errore nel caricamento del contratto', 'err');
    } finally {
      setLoadingPdfUserId(null);
    }
  };

  useEffect(() => {
    fetchUtenti();
  }, []);

  const fetchUtenti = async () => {
    try {
      const res = await api.get('/auth/all-users');
      setUtenti(res.data);
    } catch (err) {
      console.warn('Errore nel caricamento utenti:', err);
    } finally {
      setLoading(false);
    }
  };

  const approvaUtente = async (id: string) => {
    setApprovandoId(id);
    try {
      const role = roleSelezionato[id] || 'caregiver';
      await api.put(`/auth/approve/${id}`, { role });
      // Rimuovi l'utente dalla lista (approvato → va nella sezione Personale/Staff)
      setUtenti(utenti.filter(u => u._id !== id));
      mostraToast(`✅ Utente approvato con ruolo: ${roleLabels[role] || role}. Ora visibile nella sezione Personale.`, 'ok');
    } catch (err: any) {
      mostraToast(err?.response?.data?.message || 'Errore durante l\'approvazione', 'err');
    } finally {
      setApprovandoId(null);
    }
  };

  const rifiutaUtente = async (id: string) => {
    setConferma({
      msg: 'Sei sicuro di voler rifiutare questa richiesta?',
      onSi: async () => {
        setConferma(null);
        try {
          await api.put(`/auth/reject/${id}`);
          setUtenti(prev => prev.map(u => u._id === id ? { ...u, status: 'rejected' } : u));
          mostraToast('Accesso rifiutato.', 'ok');
        } catch (err: any) {
          mostraToast(err?.response?.data?.message || 'Errore durante il rifiuto', 'err');
        }
      },
    });
  };

  const openUserProfilePdf = async (id: string) => {
    setLoadingPdfUserId(id);
    try {
      const res = await api.get(`/auth/users/${id}/details`);
      const html = await generaHtmlProfilo(res.data as UtenteDettaglio);
      const win = window.open('', '_blank');
      if (!win) {
        mostraToast('Impossibile aprire la finestra per la stampa.', 'err');
        return;
      }
      win.document.write(html);
      win.document.close();
      win.focus();
    } catch (err: any) {
      mostraToast(err?.response?.data?.message || 'Errore nel caricamento dei dettagli utente.', 'err');
    } finally {
      setLoadingPdfUserId(null);
    }
  };

  const eliminaUtente = async (id: string) => {
    setConferma({
      msg: 'Sei sicuro di voler eliminare definitivamente questo utente? L\'operazione non è reversibile.',
      onSi: async () => {
        setConferma(null);
        try {
          await api.delete(`/auth/users/${id}`);
          setUtenti(prev => prev.filter(u => u._id !== id));
          mostraToast('Utente eliminato.', 'ok');
        } catch (err: any) {
          mostraToast(err?.response?.data?.message || 'Errore durante l\'eliminazione', 'err');
        }
      },
    });
  };

    const getDocumentUrl = (relativePath: string) => {
      const base = (api.defaults.baseURL as string) || 'http://localhost:4000/api';
      return `${base.replace(/\/$/, '')}/${relativePath.replace(/^\/+/, '')}`;
    };

    const escapeHtml = (value?: string) => {
      if (!value) return '—';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const formatDateString = (value?: string | null) => {
      if (!value) return '—';
      return new Date(value).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    const generaHtmlProfilo = async (user: UtenteDettaglio) => {
      const roleLabel = roleLabels[user.role] || user.role;
      const docs = Object.entries(user.documenti || {})
        .filter(([, path]) => !!path)
        .map(([key, path]) => ({
          label: key === 'documentoIdentita' ? 'Documento di identità'
            : key === 'assicurazione' ? 'Polizza assicurativa'
            : key === 'attestazioneQualifica' ? 'Attestazione di qualifica'
            : key,
          path: path as string,
        }));

      const docRows = docs.map((doc) => `
            <tr>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(doc.label)}</td>
              <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb;"><a href="${getDocumentUrl(doc.path)}" target="_blank">Apri documento</a></td>
            </tr>
          `).join('');

      // Recupera il testo completo del contratto dal backend
      let testoContrattoCompleto = '';
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/contratto/testo`);
        const data = await res.json();
        testoContrattoCompleto = data.testo || '';
      } catch {
        testoContrattoCompleto = 'Errore nel caricamento del testo del contratto';
      }

      // Compila il testo con i dati dell'utente
      const contractTesto = testoContrattoCompleto
        .replace(/Il Dr\. ___________________________________nato a _____________ il ______________, codice fiscale ___________________-e partita Iva  n° ________________________residente a ______________\. PEC Professionale ___________________________________\./, 
          `Il Dr. ${escapeHtml(user.name || '_________________')} nato a ${escapeHtml(user.luogoNascita || '___________')} il ${escapeHtml(formatDateString(user.dataNascita) || '____________')}, codice fiscale ${escapeHtml(user.codiceFiscale || '_________________')}-e partita Iva  n° ${escapeHtml(user.partitaIva || '______________________')}residente a ${escapeHtml(user.indirizzoResidenza || '____________')}. PEC Professionale ${escapeHtml(user.pec || '_________________________________')}.`)
        .replace(/di ____________________  ed è iscritto all'albo professionale dell'Ordine di ______________ numero tessera iscrizione ____________________________\;/, 
          `di ${escapeHtml(user.professione || '__________________')} ed è iscritto all'albo professionale dell'Ordine di ${escapeHtml(user.ordineAlbo || '____________')} numero tessera iscrizione ${escapeHtml(user.numeroAlbo || '__________________________')};`)
        .replace(/____________________ DOMICILIARE/, `${escapeHtml(user.professione || '____________________')} DOMICILIARE`)
        .replace(/dal __________________ al ________________/, `dal ${new Date().toLocaleDateString('it-IT')} al ${new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('it-IT')}`)
        .replace(/Letto, confermato e sottoscritto in __________________ il ______________\./, `Letto, confermato e sottoscritto in ${escapeHtml(user.luogoFirmaContratto || '________________')} il ${escapeHtml(formatDateString(user.dataFirmaContratto)) || '_____________'}.`)
        .replace(/Il\/La sottoscritto\/a _________________________ nato\/a a _________________ residente a ____________________ in _____________________________\./, 
          `Il/La sottoscritto/a ${escapeHtml(user.name || '_________________________')} nato/a a ${escapeHtml(user.luogoNascita || '_______________')} residente a ${escapeHtml(user.indirizzoResidenza || '__________________')} in ${escapeHtml(user.indirizzoResidenza || '_________________________')}.`)
        .replace(/Il\/La sottoscritto\/a \[OMISSIS\] nato\/a \[OMISSIS\] il residente in \[OMISSIS\] in/, `Il/La sottoscritto/a ${escapeHtml(user.name || '_________________________')} nato/a a ${escapeHtml(user.luogoNascita || '[OMISSIS]')} il ${escapeHtml(formatDateString(user.dataNascita) || '[OMISSIS]')} residente in ${escapeHtml(user.indirizzoResidenza || '[OMISSIS]')} in`)
        .replace(/- Casella di posta elettronica certificata professionale privata\n- Telefono mobile per reperibilità nr: \n- Autoveicoli:/, 
          `- Casella di posta elettronica certificata professionale privata: ${escapeHtml(user.pec || '_________________________')}\n- Telefono mobile per reperibilità nr: ${escapeHtml(user.telefono || '_________________________')}\n- Autoveicoli: ${escapeHtml(user.autoveicoli || '_________________________')}`)
        .replace(/Sottoscritto in _______________ il __________________\./g, `Sottoscritto in ${escapeHtml(user.luogoFirmaContratto || '_____________')} il ${escapeHtml(formatDateString(user.dataFirmaContratto)) || '_____________'}.`);

      const contrattoSection = `
      <div class="section">
        <h2>Contratto firmato</h2>
        ${user.contrattoPdfUrl ? `<p><a href="${getDocumentUrl(user.contrattoPdfUrl)}" target="_blank">Apri contratto PDF</a></p>` : ''}
        <div class="contract-text" style="padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; font-size: 0.9rem; line-height: 1.5;">
          ${contractTesto}
        </div>
        <div class="signature-block" style="margin-top: 16px;">
          ${user.firmaContratto ? `<div class="signature" style="margin-bottom: 12px;"><img src="${user.firmaContratto}" alt="Firma contratto" style="max-width: 280px; height: auto; border: 1px solid #d1d5db; padding: 8px; background: #fff;" /></div>` : '<p>Firma non disponibile</p>'}
          <div class="field"><strong>Data firma</strong><span>${escapeHtml(formatDateString(user.dataFirmaContratto))}</span></div>
          <div class="field"><strong>Luogo firma</strong><span>${escapeHtml(user.luogoFirmaContratto)}</span></div>
        </div>
      </div>`;

      return `<!DOCTYPE html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <title>Profilo utente - ${escapeHtml(user.name)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
      .header { margin-bottom: 24px; }
      .header h1 { margin: 0; font-size: 1.7rem; }
      .header p { margin: 4px 0 0; color: #4b5563; }
      .section { margin-bottom: 22px; }
      .section h2 { font-size: 1.1rem; margin-bottom: 10px; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; }
      .field { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
      .field strong { color: #111827; }
      .field span { color: #374151; }
      .signature img { max-width: 320px; height: auto; border: 1px solid #d1d5db; padding: 8px; background: #fff; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      td { vertical-align: top; }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>Profilo utente</h1>
      <p>${escapeHtml(user.name)} • ${escapeHtml(roleLabel)}</p>
    </div>
    <div class="section">
      <h2>Informazioni generali</h2>
      <div class="field"><strong>Nome completo</strong><span>${escapeHtml(user.name)}</span></div>
      <div class="field"><strong>Email</strong><span>${escapeHtml(user.email)}</span></div>
      <div class="field"><strong>Ruolo</strong><span>${escapeHtml(roleLabel)}</span></div>
      <div class="field"><strong>Stato</strong><span>${escapeHtml(user.status === 'approved' ? 'Approvato' : user.status === 'pending' ? 'In attesa' : 'Rifiutato')}</span></div>
      <div class="field"><strong>Registrato il</strong><span>${escapeHtml(formatDateString(user.createdAt))}</span></div>
      ${user.professione ? `<div class="field"><strong>Professione</strong><span>${escapeHtml(user.professione)}</span></div>` : ''}
      ${user.categoria ? `<div class="field"><strong>Categoria</strong><span>${escapeHtml(user.categoria)}</span></div>` : ''}
      ${user.telefono ? `<div class="field"><strong>Telefono</strong><span>${escapeHtml(user.telefono)}</span></div>` : ''}
      ${user.codiceFiscale ? `<div class="field"><strong>Codice fiscale</strong><span>${escapeHtml(user.codiceFiscale)}</span></div>` : ''}
      ${user.dataNascita ? `<div class="field"><strong>Data di nascita</strong><span>${escapeHtml(formatDateString(user.dataNascita))}</span></div>` : ''}
      ${user.luogoNascita ? `<div class="field"><strong>Luogo di nascita</strong><span>${escapeHtml(user.luogoNascita)}</span></div>` : ''}
      ${user.indirizzoResidenza ? `<div class="field"><strong>Residenza</strong><span>${escapeHtml(user.indirizzoResidenza)}</span></div>` : ''}
      ${user.pec ? `<div class="field"><strong>PEC</strong><span>${escapeHtml(user.pec)}</span></div>` : ''}
      ${user.tipoCollaborazione ? `<div class="field"><strong>Tipo collaborazione</strong><span>${escapeHtml(user.tipoCollaborazione)}</span></div>` : ''}
      ${user.partitaIva ? `<div class="field"><strong>Partita IVA</strong><span>${escapeHtml(user.partitaIva)}</span></div>` : ''}
      ${user.regimeFiscale ? `<div class="field"><strong>Regime fiscale</strong><span>${escapeHtml(user.regimeFiscale)}</span></div>` : ''}
      ${user.ordineAlbo ? `<div class="field"><strong>Ordine albo</strong><span>${escapeHtml(user.ordineAlbo)}</span></div>` : ''}
      ${user.numeroAlbo ? `<div class="field"><strong>Numero albo</strong><span>${escapeHtml(user.numeroAlbo)}</span></div>` : ''}
    </div>
    ${contrattoSection}
    <div class="section">
      <h2>Documenti allegati</h2>
      ${docs.length === 0 ? '<p>Nessun documento allegato.</p>' : `<table><tbody>${docRows}</tbody></table>`}
    </div>
  </body>
</html>`;
    };

    // Gestione Utenti mostra solo utenti pending e rejected (gli approvati vanno nella sezione Personale)
    const utentiGestione = utenti.filter(u => u.status === 'pending' || u.status === 'rejected');
    const utentiFiltrati = utentiGestione.filter(u => filtro === 'tutti' ? true : u.status === filtro);
    const nPending = utenti.filter(u => u.status === 'pending').length;
    const formatData = (d: string) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
      <section>
        {/* ── Toast ── */}
        {toast && (
          <div style={{
            position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
            background: toast.tipo === 'ok' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${toast.tipo === 'ok' ? '#059669' : '#dc2626'}`,
            color: toast.tipo === 'ok' ? '#065f46' : '#7f1d1d',
            borderRadius: '10px', padding: '12px 18px', fontWeight: 600,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: '0.9rem', maxWidth: '340px',
          }}>
            {toast.msg}
          </div>
        )}
        {/* ── Modale conferma ── */}
        {conferma && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
              <p style={{ margin: '0 0 20px', fontSize: '0.95rem', color: '#374151', lineHeight: 1.5 }}>{conferma.msg}</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <Button variant="secondary" size="sm" onClick={() => setConferma(null)}>
                  Annulla
                </Button>
                <Button variant="danger" size="sm" onClick={conferma.onSi}>
                  Conferma
                </Button>
              </div>
            </div>
          </div>
        )}
        <h2>👥 Gestione Utenti</h2>
        <p style={{ color: 'var(--gray-500)', marginBottom: '24px', fontSize: '0.95rem' }}>
          Approva o rifiuta le richieste di registrazione e gestisci gli accessi all'app.
        </p>

        {/* Filtri */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {(['pending', 'rejected', 'tutti'] as const).map((f) => {
          const count = f === 'tutti' ? utentiGestione.length : utentiGestione.filter(u => u.status === f).length;
          const active = filtro === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              style={{
                background: active ? '#1e4d8c' : '#f1f5f9',
                color: active ? '#fff' : '#374151',
                border: `1px solid ${active ? '#1e4d8c' : '#e2e8f0'}`,
                borderRadius: '6px',
                padding: '7px 16px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                fontWeight: active ? '600' : '400',
                position: 'relative',
              }}
            >
              {f === 'pending' && `⏳ In attesa`}
              {f === 'rejected' && `❌ Rifiutati`}
              {f === 'tutti' && `📋 Tutti`}
              <span style={{
                marginLeft: '6px',
                background: active ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                color: active ? '#fff' : '#6b7280',
                borderRadius: '10px',
                padding: '1px 7px',
                fontSize: '0.8rem',
                fontWeight: '700',
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Alert pending */}
      {nPending > 0 && filtro !== 'pending' && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#92400e', fontWeight: '600', fontSize: '0.9rem' }}>
          ⚠️ Ci sono <strong>{nPending}</strong> richieste in attesa di approvazione.{' '}
          <button type="button" onClick={() => setFiltro('pending')} style={{ background: 'none', border: 'none', color: '#1e4d8c', cursor: 'pointer', fontWeight: '700', textDecoration: 'underline', padding: 0 }}>
            Visualizza →
          </button>
        </div>
      )}

      {loading ? (
        <p>Caricamento...</p>
      ) : utentiFiltrati.length === 0 ? (
        <p style={{ color: '#666', fontStyle: 'italic' }}>Nessun utente in questa categoria.</p>
      ) : (
        <div className="document-list">
          <ul>
            {utentiFiltrati.map((utente) => {
              const st = statusColors[utente.status];
              const isPending = utente.status === 'pending';
              return (
                <li key={utente._id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <strong style={{ fontSize: '1rem' }}>{utente.name}</strong>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          background: st.bg,
                          border: `1px solid ${st.border}`,
                          color: st.color,
                        }}>
                          {st.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.88rem', color: '#555', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        <span>📧 {utente.email}</span>
                        {utente.professione && <span>💼 {utente.professione}</span>}
                        {utente.categoria && <span>🏷️ {categoriaLabels[utente.categoria] || utente.categoria}</span>}
                        <span>🔑 {roleLabels[utente.role] || utente.role}</span>
                        <span>📅 {formatData(utente.createdAt)}</span>
                      </div>
                      {/* Domicilio / Zona lavorativa (visibile solo per richieste pending) */}
                      {utente.status === 'pending' && (
                        <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.82rem' }}>
                          {utente.domicilioPartenza ? (
                            <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '2px 8px', color: '#065f46' }}>
                              {utente.role === 'paziente_registrato'
                                ? `🏠 Domicilio: ${utente.domicilioPartenza}`
                                : `📍 ${utente.domicilioPartenza} — raggio ${utente.raggioAzioneKm ?? 10} km`}
                              {utente.domicilioCoords && <span style={{ color: '#059669', marginLeft: '4px' }}>✓ geo</span>}
                            </span>
                          ) : (
                            <span style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', padding: '2px 8px', color: '#92400e' }}>
                              {utente.role === 'paziente_registrato' ? '⚠️ Domicilio non inserito' : '⚠️ Zona lavorativa non impostata'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {isPending && (
                        <>
                          <select
                            value={roleSelezionato[utente._id] || utente.role || 'caregiver'}
                            onChange={(e) => setRoleSelezionato({ ...roleSelezionato, [utente._id]: e.target.value })}
                            style={{ padding: '6px 10px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '0.85rem' }}
                          >
                            <option value="caregiver">Operatore</option>
                            <option value="coordinator">Coordinatore</option>
                            <option value="direttore">Direttore Sanitario</option>
                            <option value="admin">Admin</option>
                            <option value="paziente_registrato">Paziente / Caregiver</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => approvaUtente(utente._id)}
                            disabled={approvandoId === utente._id}
                            style={{ background: '#059669', fontSize: '0.85rem', padding: '6px 14px', opacity: approvandoId === utente._id ? 0.7 : 1 }}
                          >
                            {approvandoId === utente._id ? '⏳' : '✅ Approva'}
                          </button>
                          <button
                            type="button"
                            onClick={() => rifiutaUtente(utente._id)}
                            style={{ background: '#dc2626', fontSize: '0.85rem', padding: '6px 14px' }}
                          >
                            ❌ Rifiuta
                          </button>
                        </>
                      )}
                      {utente.status === 'rejected' && (
                        <button
                          type="button"
                          onClick={() => approvaUtente(utente._id)}
                          style={{ background: '#059669', fontSize: '0.85rem', padding: '6px 14px' }}
                        >
                          ✅ Approva ora
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openUserProfilePdf(utente._id)}
                        disabled={loadingPdfUserId === utente._id}
                        style={{ background: '#2563eb', color: '#fff', fontSize: '0.85rem', padding: '6px 14px' }}
                      >
                        {loadingPdfUserId === utente._id ? '⏳ Caricamento...' : '📄 Profilo PDF'}
                      </button>
                      {utente.status === 'approved' && utente.firmaContratto && (
                        <button
                          type="button"
                          onClick={() => apriPdfContratto(utente._id)}
                          disabled={loadingPdfUserId === utente._id}
                          style={{ background: '#059669', color: '#fff', fontSize: '0.85rem', padding: '6px 14px' }}
                        >
                          {loadingPdfUserId === utente._id ? '⏳ Caricamento...' : '📋 Contratto PDF'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => eliminaUtente(utente._id)}
                        style={{ background: '#6c757d', fontSize: '0.85rem', padding: '6px 14px' }}
                      >
                        🗑️ Elimina
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

        </div>
      )}
    </section>
  );
}

export default GestioneUtenti;
