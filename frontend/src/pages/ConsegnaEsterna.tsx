import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import { Mic, Square, Send, CheckCircle, ClipboardList, Smartphone, AlertTriangle } from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════════
// CONSEGNA DA REMOTO — pagina pubblica standalone (/scrivi-consegna) per il
// personale sul territorio: scrive la consegna dal telefono senza entrare nel
// gestionale. La consegna compare nella bacheca condivisa marcata "da remoto".
// Dettatura: Web Speech API del browser (funziona su Chrome/Android).
// Pagina installabile come app (PWA) dal menu del browser.
// ═════════════════════════════════════════════════════════════════════════════

const input: React.CSSProperties = {
  width: '100%', padding: '12px 14px', border: '1px solid #dbe3ee', borderRadius: '10px',
  fontSize: '1rem', boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff',
};
const label: React.CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '5px' };

export default function ConsegnaEsterna() {
  const [nome, setNome] = useState('');
  const [titolo, setTitolo] = useState('');
  const [tipo, setTipo] = useState<'giornata' | 'pratica' | 'generale'>('generale');
  const [priorita, setPriorita] = useState<'normale' | 'urgente'>('normale');
  const [dataGiornata, setDataGiornata] = useState('');
  const [riferimento, setRiferimento] = useState('');
  const [testo, setTesto] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviato, setInviato] = useState(false);
  const [errore, setErrore] = useState('');

  // Dettatura vocale con Web Speech API (Chrome/Android; non serve login)
  const [ascolto, setAscolto] = useState(false);
  const [micSupportato, setMicSupportato] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setMicSupportato(!!SR);
    setNome(localStorage.getItem('consegna_autore') || '');
  }, []);

  const toggleDettatura = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (ascolto && recRef.current) { recRef.current.stop(); return; }
    const rec = new SR();
    rec.lang = 'it-IT';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      let aggiunto = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) aggiunto += e.results[i][0].transcript;
      }
      if (aggiunto.trim()) setTesto(prev => (prev.trim() ? `${prev.trim()} ${aggiunto.trim()}` : aggiunto.trim()));
    };
    rec.onend = () => setAscolto(false);
    rec.onerror = () => setAscolto(false);
    recRef.current = rec;
    rec.start();
    setAscolto(true);
  };

  const invia = async () => {
    if (!nome.trim() || !titolo.trim() || !testo.trim()) {
      setErrore('Compila nome, titolo e testo della consegna.');
      return;
    }
    setBusy(true);
    setErrore('');
    try {
      await api.post('/consegne-amministrative/pubblica', {
        autoreNome: nome.trim(),
        titolo: titolo.trim(),
        testo: testo.trim(),
        tipo,
        priorita,
        dataGiornata: tipo === 'giornata' && dataGiornata ? dataGiornata : undefined,
        riferimento: tipo === 'pratica' && riferimento.trim() ? riferimento.trim() : undefined,
      });
      localStorage.setItem('consegna_autore', nome.trim());
      setInviato(true);
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      setErrore(err?.response?.data?.message || 'Errore nell\'invio della consegna. Riprova.');
    } finally {
      setBusy(false);
    }
  };

  const ricomincia = () => {
    setTitolo(''); setTesto(''); setRiferimento(''); setDataGiornata('');
    setTipo('generale'); setPriorita('normale'); setInviato(false); setErrore('');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#eff6ff,#ffffff 55%)', fontFamily: "'Segoe UI',system-ui,sans-serif", padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        {/* Header brandizzato */}
        <div style={{ background: '#1e4d8c', borderRadius: '16px', padding: '18px 20px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src="/logo.png" alt="Abbraccio" style={{ width: '52px', height: '52px', objectFit: 'contain', background: '#fff', borderRadius: '10px', padding: '4px' }} />
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.2 }}>Consegna amministrativa</div>
            <div style={{ color: '#bfdbfe', fontSize: '0.8rem' }}>Abbraccio Cure Domiciliari — invio da remoto</div>
          </div>
        </div>

        {inviato ? (
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #bbf7d0', boxShadow: '0 4px 20px rgba(0,0,0,.06)', padding: '32px 24px', textAlign: 'center' }}>
            <CheckCircle size={52} color="#16a34a" style={{ margin: '0 auto 12px' }} />
            <h2 style={{ color: '#166534', margin: '0 0 8px', fontSize: '1.3rem' }}>Consegna inviata!</h2>
            <p style={{ color: '#64748b', fontSize: '0.92rem', margin: '0 0 20px' }}>
              La tua consegna è stata registrata ed è ora visibile a tutta l'équipe come <strong>da gestire</strong>.
            </p>
            <button type="button" onClick={ricomincia}
              style={{ background: '#1e4d8c', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 24px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
              ✏️ Scrivi un'altra consegna
            </button>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,.06)', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d8c', fontWeight: 800, fontSize: '1rem', marginBottom: '16px' }}>
              <ClipboardList size={20} /> Nuova consegna per l'équipe
            </div>

            <div style={{ marginBottom: '12px' }}>
              <span style={label}>Il tuo nome e cognome *</span>
              <input style={input} value={nome} onChange={e => setNome(e.target.value)} placeholder="Es. Maria Rossi" />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <span style={label}>Titolo consegna *</span>
              <input style={input} value={titolo} onChange={e => setTitolo(e.target.value)} placeholder="Es. Turno di oggi — note per l'ufficio" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <span style={label}>Tipo</span>
                <select style={input} value={tipo} onChange={e => setTipo(e.target.value as any)}>
                  <option value="generale">📋 Generale</option>
                  <option value="giornata">📅 Giornata lavorativa</option>
                  <option value="pratica">📂 Pratica</option>
                </select>
              </div>
              <div>
                <span style={label}>Priorità</span>
                <select style={{ ...input, borderColor: priorita === 'urgente' ? '#dc2626' : '#dbe3ee' }} value={priorita} onChange={e => setPriorita(e.target.value as any)}>
                  <option value="normale">Normale</option>
                  <option value="urgente">🔴 Urgente</option>
                </select>
              </div>
            </div>

            {tipo === 'giornata' && (
              <div style={{ marginBottom: '12px' }}>
                <span style={label}>Data giornata</span>
                <input style={input} type="date" value={dataGiornata} onChange={e => setDataGiornata(e.target.value)} />
              </div>
            )}
            {tipo === 'pratica' && (
              <div style={{ marginBottom: '12px' }}>
                <span style={label}>Riferimento pratica</span>
                <input style={input} value={riferimento} onChange={e => setRiferimento(e.target.value)} placeholder="Es. Rossi Mario — contratto badante" />
              </div>
            )}

            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ ...label, marginBottom: 0 }}>Testo consegna *</span>
                {micSupportato && (
                  <button type="button" onClick={toggleDettatura}
                    style={{ border: 'none', borderRadius: '8px', padding: '8px 12px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', background: ascolto ? '#dc2626' : '#7c3aed', color: '#fff' }}>
                    {ascolto ? <Square size={15} /> : <Mic size={15} />}
                    {ascolto ? 'Ferma dettatura' : '🎤 Detta'}
                  </button>
                )}
              </div>
              <textarea style={{ ...input, minHeight: '130px', resize: 'vertical' }} value={testo} onChange={e => setTesto(e.target.value)}
                placeholder={ascolto ? 'Parla: il testo viene scritto qui…' : 'Scrivi (o detta) la consegna: cosa è stato fatto, cosa resta da fare…'} />
              {ascolto && <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#7c3aed', fontWeight: 600 }}>🎤 Sto ascoltando… parla normalmente.</p>}
            </div>

            {errore && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '10px', padding: '10px 12px', fontSize: '0.88rem', fontWeight: 600, marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <AlertTriangle size={16} /> {errore}
              </div>
            )}

            <button type="button" onClick={invia} disabled={busy}
              style={{ width: '100%', background: busy ? '#94a3b8' : '#1e4d8c', color: '#fff', border: 'none', borderRadius: '10px', padding: '14px', fontWeight: 800, fontSize: '1.05rem', cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Send size={18} /> {busy ? 'Invio in corso…' : 'Invia la consegna'}
            </button>

            <p style={{ margin: '12px 0 0', fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
              La consegna sarà visibile a tutta l'équipe nella bacheca condivisa.
            </p>
          </div>
        )}

        {/* Suggerimento installazione app */}
        <div style={{ marginTop: '16px', background: 'rgba(30,77,140,0.06)', border: '1px dashed #93c5fd', borderRadius: '12px', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <Smartphone size={20} color="#1e4d8c" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
            <strong>Vuoi l'icona sul telefono?</strong> Apri il menu del browser (⋮ su Android, tasto condividi su iPhone) e scegli <strong>"Aggiungi a schermata Home"</strong>: avrai l'app con questa pagina a portata di tocco.
          </p>
        </div>
      </div>
    </div>
  );
}
