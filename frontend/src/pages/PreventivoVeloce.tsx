import { useState } from 'react';
import api from '../api/api';
import CalcolatorePreventivoListino, { RisultatoCalcolatore } from '../components/CalcolatorePreventivoListino';
import { Calculator, Eye, Printer, Mail, MessageCircle, CheckCircle, User } from 'lucide-react';

const WA_NUMERO = '393514175117';
const euro = (n: number) => `€ ${Number(n || 0).toFixed(2).replace('.', ',')}`;

// ═════════════════════════════════════════════════════════════════════════════
// Preventivo veloce — calcola un preventivo dal listino SENZA creare paziente
// né documento. Solo nome + cognome: si genera un PDF bozza da mostrare,
// stampare, inviare via email o condividere su WhatsApp.
// Disponibile solo nell'area riservata Gestione Privata (prezzi modificabili).
// ═════════════════════════════════════════════════════════════════════════════
export default function PreventivoVeloce() {
  const [risultato, setRisultato] = useState<RisultatoCalcolatore | null>(null);
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [busy, setBusy] = useState<'pdf' | 'email' | null>(null);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; testo: string } | null>(null);

  const payload = () => ({
    nome: nome.trim(),
    cognome: cognome.trim(),
    email: email.trim(),
    prestazioni: risultato?.prestazioni || [],
  });

  const scaricaBlob = (data: Blob, nomeFile: string, apri: boolean) => {
    const url = URL.createObjectURL(data);
    if (apri) {
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeFile;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  };

  const generaPdf = async (apri: boolean) => {
    if (!risultato) return;
    setBusy('pdf');
    setMsg(null);
    try {
      const res = await api.post('/preventivo-veloce/pdf', payload(), { responseType: 'blob' });
      const nomeFile = `PREVENTIVO-${`${nome} ${cognome}`.trim().replace(/\s+/g, '_') || 'bozza'}.pdf`;
      scaricaBlob(res.data, nomeFile, apri);
      setMsg({ tipo: 'ok', testo: apri ? 'PDF aperto in una nuova scheda: puoi stamparlo da lì.' : 'PDF scaricato.' });
    } catch (err: any) {
      setMsg({ tipo: 'err', testo: err?.response?.data?.message || 'Errore nella generazione del PDF' });
    } finally {
      setBusy(null);
    }
  };

  const inviaEmail = async () => {
    if (!risultato) return;
    const dest = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dest)) {
      setMsg({ tipo: 'err', testo: 'Inserisci un indirizzo email valido per l\'invio.' });
      return;
    }
    setBusy('email');
    setMsg(null);
    try {
      await api.post('/preventivo-veloce/email', { ...payload(), emailDestinatario: dest });
      setMsg({ tipo: 'ok', testo: `Preventivo inviato via email a ${dest}.` });
    } catch (err: any) {
      setMsg({ tipo: 'err', testo: err?.response?.data?.message || 'Errore nell\'invio dell\'email' });
    } finally {
      setBusy(null);
    }
  };

  const apriWhatsApp = () => {
    if (!risultato) return;
    const righe = risultato.prestazioni
      .map(p => `• ${p.descrizione} — ${euro(p.prezzoUnitario * p.quantita)}`)
      .join('\n');
    const testo = [
      `🧾 Preventivo Abbraccio Cure Domiciliari`,
      `${`${nome} ${cognome}`.trim()}`,
      '',
      righe,
      '',
      `Totale: ${euro(risultato.totale)}`,
      '',
      `Il preventivo in PDF può essere inviato via email o scaricato dall'area riservata.`,
    ].join('\n');
    const tel = telefono.replace(/[^\d]/g, '');
    const numero = tel ? (tel.startsWith('39') ? tel : `39${tel}`) : WA_NUMERO;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(testo)}`, '_blank');
  };

  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.92rem', boxSizing: 'border-box', fontFamily: 'inherit' };
  const label: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' };

  return (
    <div className="page-container tw-p-5">
      <div className="tw-mb-5">
        <h1 className="tw-flex tw-items-center tw-gap-2 tw-text-blue-900 tw-m-0 tw-text-2xl tw-font-extrabold">
          <Calculator size={26} /> Preventivo veloce — senza anagrafica
        </h1>
        <p className="tw-text-slate-500 tw-text-sm tw-mt-1.5 tw-mb-0">
          Calcola un preventivo dal listino senza creare il paziente: inserisci nome e cognome, poi visualizza/scarica il PDF o invialo via email o WhatsApp. I prezzi possono essere variati (solo area riservata).
        </p>
      </div>

      <CalcolatorePreventivoListino
        prezziModificabili
        labelConferma="Conferma: prepara PDF e invio"
        onConferma={(r) => { setRisultato(r); setMsg(null); }}
      />

      {risultato && (
        <div className="tw-mt-5 tw-bg-white tw-rounded-2xl tw-border tw-border-blue-200 tw-shadow-sm tw-p-5 tw-max-w-[720px]">
          <h2 className="tw-flex tw-items-center tw-gap-2 tw-m-0 tw-mb-4 tw-text-lg tw-text-blue-900 tw-font-bold">
            <User size={20} /> Destinatario del preventivo
          </h2>
          <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-3 tw-mb-3">
            <div>
              <span style={label}>Nome *</span>
              <input style={input} value={nome} onChange={e => setNome(e.target.value)} placeholder="Es. Maria" />
            </div>
            <div>
              <span style={label}>Cognome *</span>
              <input style={input} value={cognome} onChange={e => setCognome(e.target.value)} placeholder="Es. Rossi" />
            </div>
            <div>
              <span style={label}>Email (per l'invio)</span>
              <input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@email.it" />
            </div>
            <div>
              <span style={label}>Telefono WhatsApp (opzionale)</span>
              <input style={input} value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Lascia vuoto per il numero Abbraccio" />
            </div>
          </div>

          {msg && (
            <div className={`tw-text-sm tw-font-semibold tw-rounded-lg tw-p-2.5 tw-mb-3 ${msg.tipo === 'ok' ? 'tw-bg-green-50 tw-text-green-700 tw-border tw-border-green-200' : 'tw-bg-red-50 tw-text-red-700 tw-border tw-border-red-200'}`}>
              {msg.tipo === 'ok' ? '✅' : '⚠️'} {msg.testo}
            </div>
          )}

          <div className="tw-flex tw-flex-wrap tw-gap-2.5">
            <button type="button" onClick={() => generaPdf(true)} disabled={busy !== null || !nome.trim() || !cognome.trim()}
              className="tw-flex tw-items-center tw-gap-1.5 tw-px-4 tw-py-2.5 tw-rounded-lg tw-border tw-border-blue-600 tw-bg-white tw-text-blue-800 tw-font-bold tw-cursor-pointer disabled:tw-opacity-50">
              <Eye size={17} /> Visualizza / stampa PDF
            </button>
            <button type="button" onClick={() => generaPdf(false)} disabled={busy !== null || !nome.trim() || !cognome.trim()}
              className="tw-flex tw-items-center tw-gap-1.5 tw-px-4 tw-py-2.5 tw-rounded-lg tw-border tw-border-slate-300 tw-bg-white tw-text-slate-700 tw-font-bold tw-cursor-pointer disabled:tw-opacity-50">
              <Printer size={17} /> {busy === 'pdf' ? 'Generazione...' : 'Scarica PDF'}
            </button>
            <button type="button" onClick={inviaEmail} disabled={busy !== null || !nome.trim() || !cognome.trim() || !email.trim()}
              className="tw-flex tw-items-center tw-gap-1.5 tw-px-4 tw-py-2.5 tw-rounded-lg tw-border-0 tw-bg-blue-700 tw-text-white tw-font-bold tw-cursor-pointer disabled:tw-opacity-50">
              <Mail size={17} /> {busy === 'email' ? 'Invio...' : 'Invia via email'}
            </button>
            <button type="button" onClick={apriWhatsApp} disabled={!nome.trim() || !cognome.trim()}
              className="tw-flex tw-items-center tw-gap-1.5 tw-px-4 tw-py-2.5 tw-rounded-lg tw-border-0 tw-text-white tw-font-bold tw-cursor-pointer disabled:tw-opacity-50" style={{ background: '#25d366' }}>
              <MessageCircle size={17} /> WhatsApp
            </button>
          </div>
          <p className="tw-text-xs tw-text-slate-400 tw-mt-3 tw-mb-0 tw-flex tw-items-center tw-gap-1.5">
            <CheckCircle size={13} /> Totale preventivo: <strong className="tw-text-slate-600">{euro(risultato.totale)}</strong>
            {risultato.scontoApplicato && <span> · sconto {euro(risultato.sconto)} applicato</span>} · nessun paziente né documento creato.
          </p>
        </div>
      )}
    </div>
  );
}
