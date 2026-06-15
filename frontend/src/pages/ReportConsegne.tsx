import { useState, useEffect } from 'react';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Package, Calendar, Search, FileText, Printer, Download, ChevronDown, ChevronUp, ClipboardList, Truck } from 'lucide-react';
import { Button } from '../components/ui/Button';

interface ConsegnaItem {
  nome: string;
  categoria: 'presidio' | 'farmaco';
  unitaMisura: string;
  quantitaAutorizzata: number;
}

interface Consegna {
  _id: string;
  operatoreId: string;
  operatoreNome: string;
  items: ConsegnaItem[];
  dataConsegna: string;
  consegnataDa: string;
  noteAdmin?: string;
}

interface RichiestaItem {
  _id?: string;
  supplyId?: string;
  nome: string;
  categoria: 'presidio' | 'farmaco';
  unitaMisura: string;
  quantitaRichiesta: number;
  quantitaAutorizzata?: number;
}

interface Richiesta {
  _id: string;
  operatoreId: string;
  operatoreNome: string;
  items: RichiestaItem[];
  dataRichiesta: string;
  stato: 'in_attesa' | 'gestita' | 'rifiutata' | 'consegnata';
  noteAdmin?: string;
  noteOperatore?: string;
}

export default function ReportConsegne() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'consegne' | 'richieste'>('consegne');
  const [consegne, setConsegne] = useState<Consegna[]>([]);
  const [richieste, setRichieste] = useState<Richiesta[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataInizio, setDataInizio] = useState('');
  const [dataFine, setDataFine] = useState('');
  const [ricercaOperatore, setRicercaOperatore] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Verifica se l'utente è admin/coordinatore
  const isAdmin = user?.role === 'admin' || user?.role === 'coordinator' || user?.role === 'direttore';

  useEffect(() => {
    caricaDati();
  }, []);

  const caricaDati = async () => {
    setLoading(true);
    try {
      await Promise.all([caricaConsegne(), caricaRichieste()]);
    } finally {
      setLoading(false);
    }
  };

  const caricaConsegne = async () => {
    try {
      const params: any = {};
      if (dataInizio) params.dataInizio = dataInizio;
      if (dataFine) params.dataFine = dataFine;
      if (!isAdmin && user?.id) params.operatoreId = user.id;
      
      const res = await api.get('/supply-requests/consegne', { params });
      setConsegne(res.data);
    } catch (err) {
      console.error('Errore caricamento consegne:', err);
    }
  };

  const caricaRichieste = async () => {
    try {
      const params: any = {};
      if (dataInizio) params.dataInizio = dataInizio;
      if (dataFine) params.dataFine = dataFine;
      if (!isAdmin && user?.id) params.operatoreId = user.id;
      
      const res = await api.get('/supply-requests', { params });
      setRichieste(res.data);
    } catch (err) {
      console.error('Errore caricamento richieste:', err);
    }
  };

  // Funzioni per gestire le richieste
  const gestisciRichiesta = async (id: string, items: any[], noteAdmin?: string) => {
    try {
      await api.patch(`/supply-requests/${id}/gestisci`, { items, noteAdmin });
      await caricaDati();
      alert('✅ Richiesta gestita con successo');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella gestione richiesta');
    }
  };

  const segnaComeConsegnato = async (id: string) => {
    try {
      await api.patch(`/supply-requests/${id}/consegna`);
      await caricaDati();
      alert('✅ Richiesta segnata come consegnata');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nella segnalazione consegna');
    }
  };

  const eliminaRichiesta = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa richiesta?')) return;
    try {
      await api.delete(`/supply-requests/${id}`);
      await caricaDati();
      alert('✅ Richiesta eliminata');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nell\'eliminazione');
    }
  };

  const filtraConsegne = () => {
    return consegne.filter(c => {
      const matchOperatore = isAdmin 
        ? c.operatoreNome.toLowerCase().includes(ricercaOperatore.toLowerCase())
        : true;
      return matchOperatore;
    });
  };

  const filtraRichieste = () => {
    return richieste.filter(r => {
      const matchOperatore = isAdmin 
        ? r.operatoreNome.toLowerCase().includes(ricercaOperatore.toLowerCase())
        : true;
      return matchOperatore;
    });
  };

  const consegneFiltrate = filtraConsegne();
  const richiesteFiltrate = filtraRichieste();

  // Calcolo totali
  const totaliPerCategoria = consegneFiltrate.reduce((acc, c) => {
    c.items.forEach(item => {
      const key = `${item.nome} (${item.unitaMisura})`;
      if (!acc[key]) {
        acc[key] = { 
          nome: item.nome, 
          unitaMisura: item.unitaMisura, 
          categoria: item.categoria, 
          totale: 0 
        };
      }
      acc[key].totale += item.quantitaAutorizzata;
    });
    return acc;
  }, {} as Record<string, { nome: string; unitaMisura: string; categoria: string; totale: number }>);

  const totaliRichiestePerCategoria = richiesteFiltrate.reduce((acc, r) => {
    r.items.forEach(item => {
      const key = `${item.nome} (${item.unitaMisura})`;
      if (!acc[key]) {
        acc[key] = { 
          nome: item.nome, 
          unitaMisura: item.unitaMisura, 
          categoria: item.categoria, 
          totaleRichiesto: 0,
          totaleAutorizzato: 0
        };
      }
      acc[key].totaleRichiesto += item.quantitaRichiesta;
      if (item.quantitaAutorizzata) {
        acc[key].totaleAutorizzato += item.quantitaAutorizzata;
      }
    });
    return acc;
  }, {} as Record<string, { nome: string; unitaMisura: string; categoria: string; totaleRichiesto: number; totaleAutorizzato: number }>);

  const generaPDFHtml = (): string => {
    const periodo = dataInizio && dataFine 
      ? `${new Date(dataInizio).toLocaleDateString('it-IT')} - ${new Date(dataFine).toLocaleDateString('it-IT')}`
      : dataInizio 
        ? `Dal ${new Date(dataInizio).toLocaleDateString('it-IT')}`
        : dataFine 
          ? `Fino al ${new Date(dataFine).toLocaleDateString('it-IT')}`
          : 'Tutto il periodo';

    const righe = consegneFiltrate.map(c => `
      <tr>
        <td>${new Date(c.dataConsegna).toLocaleDateString('it-IT')}</td>
        <td><strong>${c.operatoreNome}</strong></td>
        <td>${c.items.map(i => `${i.nome}: ${i.quantitaAutorizzata} ${i.unitaMisura}`).join('<br>')}</td>
        <td>${c.consegnataDa}</td>
      </tr>
    `).join('');

    const totaliHtml = Object.values(totaliPerCategoria).map(t => `
      <div style="display: inline-block; margin: 5px; padding: 8px 12px; background: ${t.categoria === 'farmaco' ? '#ede9fe' : '#e0f2fe'}; border-radius: 6px; border: 1px solid ${t.categoria === 'farmaco' ? '#7c3aed' : '#0369a1'};">
        <strong>${t.nome}</strong>: ${t.totale} ${t.unitaMisura}
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Report Consegne Materiali</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 24px; }
    h1 { font-size: 20px; color: #1e4d8c; margin: 0 0 4px; }
    h2 { font-size: 14px; color: #374151; margin: 20px 0 8px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .logo { font-size: 18px; font-weight: 700; color: #1e4d8c; }
    .periodo { background: #f1f5f9; padding: 8px 12px; border-radius: 6px; display: inline-block; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #1e4d8c; color: #fff; padding: 8px; text-align: left; font-size: 11px; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; vertical-align: top; }
    tr:nth-child(even) { background: #f8fafc; }
    .totali { margin: 20px 0; }
    .riepilogo { margin-top: 20px; background: #f1f5f9; padding: 12px; border-radius: 6px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; }
    .badge-farmaco { background: #ede9fe; color: #7c3aed; }
    .badge-presidio { background: #e0f2fe; color: #0369a1; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">🏥 Abbraccio Cure Domiciliari</div>
      <h1>Report Consegne Materiali</h1>
      <div class="periodo">📅 Periodo: ${periodo}</div>
    </div>
    <div style="text-align: right; font-size: 11px; color: #888;">
      <div>Generato il: ${new Date().toLocaleDateString('it-IT')}</div>
      <div>${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>

  <h2>📋 Dettaglio Consegne (${consegneFiltrate.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Data Consegna</th>
        <th>Operatore</th>
        <th>Materiali Consegnati</th>
        <th>Consegnata da</th>
      </tr>
    </thead>
    <tbody>
      ${righe || '<tr><td colspan="4" style="text-align: center; color: #888;">Nessuna consegna trovata</td></tr>'}
    </tbody>
  </table>

  <h2>📊 Totali per Materiale</h2>
  <div class="totali">
    ${totaliHtml || '<p style="color: #888;">Nessun dato disponibile</p>'}
  </div>

  <div class="riepilogo">
    <p><strong>Totale consegne:</strong> ${consegneFiltrate.length}</p>
    <p><strong>Totale operatori coinvolti:</strong> ${new Set(consegneFiltrate.map(c => c.operatoreId)).size}</p>
  </div>

  <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #888;">
    <span>App Abbraccio Cure Domiciliari — Documento generato automaticamente</span>
  </div>
</body>
</html>`;
  };

  const visualizzaPDF = () => {
    const html = generaPDFHtml();
    const win = window.open('', '_blank');
    if (!win) { alert('Impossibile aprire la finestra. Controlla il blocco popup.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const stampaPDF = () => {
    const html = generaPDFHtml();
    const win = window.open('', '_blank');
    if (!win) { alert('Impossibile aprire la finestra. Controlla il blocco popup.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  const formatData = (data: string) => {
    return new Date(data).toLocaleDateString('it-IT', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <section className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', color: '#1e4d8c' }}>
          <Package size={28} />
          Richieste e Consegne Materiali
        </h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={visualizzaPDF} className="btn-secondary">
            <FileText size={18} />
            Visualizza PDF
          </button>
          <button onClick={stampaPDF} className="btn-primary">
            <Printer size={18} />
            Stampa PDF
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div style={{ 
        display: 'flex', 
        gap: '0', 
        marginBottom: '24px',
        background: 'white',
        borderRadius: '12px',
        padding: '4px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0'
      }}>
        <button
          onClick={() => setActiveTab('consegne')}
          style={{
            flex: 1,
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: activeTab === 'consegne' ? '#1e4d8c' : 'transparent',
            color: activeTab === 'consegne' ? 'white' : '#374151',
            transition: 'all 0.2s ease'
          }}
        >
          <Truck size={20} />
          Report Consegna Materiali
          <span style={{ 
            background: activeTab === 'consegne' ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.75rem'
          }}>
            {consegneFiltrate.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('richieste')}
          style={{
            flex: 1,
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: activeTab === 'richieste' ? '#1e4d8c' : 'transparent',
            color: activeTab === 'richieste' ? 'white' : '#374151',
            transition: 'all 0.2s ease'
          }}
        >
          <ClipboardList size={20} />
          Richieste Materiali
          <span style={{ 
            background: activeTab === 'richieste' ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.75rem'
          }}>
            {richiesteFiltrate.length}
          </span>
        </button>
      </div>

      {/* Filtri */}
      <div style={{ 
        background: 'white', 
        borderRadius: '12px', 
        padding: '20px', 
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#374151' }}>
          <Search size={20} />
          Filtri di Ricerca
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
              Data Inizio
            </label>
            <input 
              type="date" 
              value={dataInizio} 
              onChange={(e) => setDataInizio(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
              Data Fine
            </label>
            <input 
              type="date" 
              value={dataFine} 
              onChange={(e) => setDataFine(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
            />
          </div>
          {isAdmin && (
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Operatore
              </label>
              <input 
                type="text" 
                placeholder="Cerca operatore..."
                value={ricercaOperatore} 
                onChange={(e) => setRicercaOperatore(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}
              />
            </div>
          )}
          <div>
            <button 
              onClick={caricaDati}
              style={{ 
                width: '100%', 
                padding: '10px 20px', 
                background: '#1e4d8c', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Search size={18} />
              Cerca
            </button>
          </div>
        </div>
      </div>

      {/* Totali */}
      {activeTab === 'consegne' && Object.keys(totaliPerCategoria).length > 0 && (
        <div style={{ 
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', 
          borderRadius: '12px', 
          padding: '20px', 
          marginBottom: '24px',
          border: '1px solid #bae6fd'
        }}>
          <h3 style={{ margin: '0 0 12px', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Truck size={20} />
            Totali Materiali Consegnati
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {Object.values(totaliPerCategoria).map((t, idx) => (
              <div key={idx} style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px',
                padding: '8px 14px', 
                background: t.categoria === 'farmaco' ? '#ede9fe' : '#e0f2fe', 
                borderRadius: '20px',
                border: `1px solid ${t.categoria === 'farmaco' ? '#7c3aed' : '#0369a1'}`,
                fontSize: '0.9rem'
              }}>
                <span style={{ fontSize: '1rem' }}>{t.categoria === 'farmaco' ? '💊' : '🏥'}</span>
                <strong>{t.nome}</strong>: {t.totale} {t.unitaMisura}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'richieste' && Object.keys(totaliRichiestePerCategoria).length > 0 && (
        <div style={{ 
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
          borderRadius: '12px', 
          padding: '20px', 
          marginBottom: '24px',
          border: '1px solid #f59e0b'
        }}>
          <h3 style={{ margin: '0 0 12px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={20} />
            Totali Richieste Materiali
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {Object.values(totaliRichiestePerCategoria).map((t, idx) => (
              <div key={idx} style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '6px',
                padding: '8px 14px', 
                background: t.categoria === 'farmaco' ? '#ede9fe' : '#fef3c7', 
                borderRadius: '20px',
                border: `1px solid ${t.categoria === 'farmaco' ? '#7c3aed' : '#f59e0b'}`,
                fontSize: '0.9rem'
              }}>
                <span style={{ fontSize: '1rem' }}>{t.categoria === 'farmaco' ? '💊' : '🏥'}</span>
                <strong>{t.nome}</strong>: {t.totaleRichiesto} {t.unitaMisura} {t.totaleAutorizzato > 0 && <span style={{ color: '#059669' }}>(✓ {t.totaleAutorizzato})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista consegne o richieste */}
      {activeTab === 'consegne' && loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          <div className="skeleton skeleton-card" style={{ margin: '0 auto 20px', width: '60px', height: '60px', borderRadius: '50%' }}></div>
          <p>Caricamento consegne...</p>
        </div>
      ) : consegneFiltrate.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px', 
          background: '#f9fafb', 
          borderRadius: '12px',
          border: '2px dashed #e5e7eb'
        }}>
          <Package size={48} style={{ color: '#9ca3af', marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px', color: '#4b5563' }}>Nessuna consegna trovata</h3>
          <p style={{ margin: 0, color: '#6b7280' }}>
            {dataInizio || dataFine 
              ? 'Prova a modificare i filtri di ricerca' 
              : 'Non ci sono consegne registrate nel sistema'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {consegneFiltrate.map((consegna) => (
            <div 
              key={consegna._id} 
              style={{ 
                background: 'white', 
                borderRadius: '12px', 
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease',
              }}
              className="card-hover"
            >
              {/* Header consegna */}
              <div 
                onClick={() => setExpandedId(expandedId === consegna._id ? null : consegna._id)}
                style={{ 
                  padding: '16px 20px', 
                  background: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  borderBottom: expandedId === consegna._id ? '1px solid #e2e8f0' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '12px', 
                    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#1e4d8c'
                  }}>
                    <Package size={24} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e4d8c', marginBottom: '4px' }}>
                      {isAdmin ? consegna.operatoreNome : 'Consegna effettuata'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={14} />
                      {formatData(consegna.dataConsegna)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ 
                    fontSize: '0.875rem', 
                    color: '#6b7280',
                    background: '#f1f5f9',
                    padding: '4px 12px',
                    borderRadius: '20px'
                  }}>
                    {consegna.items.length} {consegna.items.length === 1 ? 'articolo' : 'articoli'}
                  </span>
                  {expandedId === consegna._id ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
                </div>
              </div>

              {/* Dettaglio consegna */}
              {expandedId === consegna._id && (
                <div style={{ padding: '20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.875rem', color: '#374151' }}>Articolo</th>
                        <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: '0.875rem', color: '#374151' }}>Categoria</th>
                        <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: '0.875rem', color: '#374151' }}>Quantità</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consegna.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 8px', fontWeight: 500 }}>
                            {item.nome}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                            <span style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              background: item.categoria === 'farmaco' ? '#ede9fe' : '#e0f2fe',
                              color: item.categoria === 'farmaco' ? '#7c3aed' : '#0369a1'
                            }}>
                              {item.categoria === 'farmaco' ? '💊 Farmaco' : '🏥 Presidio'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, color: '#1e4d8c' }}>
                            {item.quantitaAutorizzata} {item.unitaMisura}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {consegna.noteAdmin && (
                    <div style={{ 
                      marginTop: '16px', 
                      padding: '12px 16px', 
                      background: '#fffbeb', 
                      borderRadius: '8px',
                      border: '1px solid #fde68a',
                      fontSize: '0.875rem',
                      color: '#92400e'
                    }}>
                      <strong>📝 Note:</strong> {consegna.noteAdmin}
                    </div>
                  )}
                  
                  <div style={{ 
                    marginTop: '16px', 
                    fontSize: '0.875rem', 
                    color: '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span>✓ Consegnata da:</span>
                    <strong style={{ color: '#374151' }}>{consegna.consegnataDa}</strong>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lista richieste */}
      {activeTab === 'richieste' && loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          <div className="skeleton skeleton-card" style={{ margin: '0 auto 20px', width: '60px', height: '60px', borderRadius: '50%' }}></div>
          <p>Caricamento richieste...</p>
        </div>
      ) : activeTab === 'richieste' && richiesteFiltrate.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px', 
          background: '#f9fafb', 
          borderRadius: '12px',
          border: '2px dashed #e5e7eb'
        }}>
          <ClipboardList size={48} style={{ color: '#9ca3af', marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 8px', color: '#4b5563' }}>Nessuna richiesta trovata</h3>
          <p style={{ margin: 0, color: '#6b7280' }}>
            {dataInizio || dataFine 
              ? 'Prova a modificare i filtri di ricerca' 
              : 'Non ci sono richieste registrate nel sistema'}
          </p>
        </div>
      ) : activeTab === 'richieste' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {richiesteFiltrate.map((richiesta) => (
            <div 
              key={richiesta._id} 
              style={{ 
                background: 'white', 
                borderRadius: '12px', 
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease',
              }}
              className="card-hover"
            >
              {/* Header richiesta */}
              <div 
                onClick={() => setExpandedId(expandedId === richiesta._id ? null : richiesta._id)}
                style={{ 
                  padding: '16px 20px', 
                  background: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  borderBottom: expandedId === richiesta._id ? '1px solid #e2e8f0' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '12px', 
                    background: richiesta.stato === 'consegnata' ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' : 
                                richiesta.stato === 'gestita' ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' :
                                richiesta.stato === 'rifiutata' ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' :
                                'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: richiesta.stato === 'consegnata' ? '#059669' : 
                          richiesta.stato === 'gestita' ? '#1e4d8c' :
                          richiesta.stato === 'rifiutata' ? '#dc2626' :
                          '#b45309'
                  }}>
                    <ClipboardList size={24} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1e4d8c', marginBottom: '4px' }}>
                      {isAdmin ? richiesta.operatoreNome : 'Richiesta materiali'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={14} />
                      {formatData(richiesta.dataRichiesta)}
                      <span style={{ 
                        marginLeft: '8px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: richiesta.stato === 'consegnata' ? '#d1fae5' :
                                    richiesta.stato === 'gestita' ? '#dbeafe' :
                                    richiesta.stato === 'rifiutata' ? '#fee2e2' :
                                    '#fef3c7',
                        color: richiesta.stato === 'consegnata' ? '#059669' :
                               richiesta.stato === 'gestita' ? '#1e4d8c' :
                               richiesta.stato === 'rifiutata' ? '#dc2626' :
                               '#b45309'
                      }}>
                        {richiesta.stato}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ 
                    fontSize: '0.875rem', 
                    color: '#6b7280',
                    background: '#f1f5f9',
                    padding: '4px 12px',
                    borderRadius: '20px'
                  }}>
                    {richiesta.items.length} {richiesta.items.length === 1 ? 'articolo' : 'articoli'}
                  </span>
                  {expandedId === richiesta._id ? <ChevronUp size={20} color="#6b7280" /> : <ChevronDown size={20} color="#6b7280" />}
                </div>
              </div>

              {/* Dettaglio richiesta */}
              {expandedId === richiesta._id && (
                <div style={{ padding: '20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.875rem', color: '#374151' }}>Articolo</th>
                        <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: '0.875rem', color: '#374151' }}>Categoria</th>
                        <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: '0.875rem', color: '#374151' }}>Richiesta</th>
                        <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: '0.875rem', color: '#374151' }}>Autorizzata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {richiesta.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 8px', fontWeight: 500 }}>
                            {item.nome}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                            <span style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              background: item.categoria === 'farmaco' ? '#ede9fe' : '#e0f2fe',
                              color: item.categoria === 'farmaco' ? '#7c3aed' : '#0369a1'
                            }}>
                              {item.categoria === 'farmaco' ? '💊 Farmaco' : '🏥 Presidio'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 600, color: '#b45309' }}>
                            {item.quantitaRichiesta} {item.unitaMisura}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, color: item.quantitaAutorizzata ? '#059669' : '#9ca3af' }}>
                            {item.quantitaAutorizzata || '-'} {item.quantitaAutorizzata ? item.unitaMisura : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {richiesta.noteOperatore && (
                    <div style={{ 
                      marginTop: '16px', 
                      padding: '12px 16px', 
                      background: '#eff6ff', 
                      borderRadius: '8px',
                      border: '1px solid #bfdbfe',
                      fontSize: '0.875rem',
                      color: '#1e40af'
                    }}>
                      <strong>📝 Note Operatore:</strong> {richiesta.noteOperatore}
                    </div>
                  )}
                  
                  {richiesta.noteAdmin && (
                    <div style={{ 
                      marginTop: '16px', 
                      padding: '12px 16px', 
                      background: '#fffbeb', 
                      borderRadius: '8px',
                      border: '1px solid #fde68a',
                      fontSize: '0.875rem',
                      color: '#92400e'
                    }}>
                      <strong>📝 Risposta Admin:</strong> {richiesta.noteAdmin}
                    </div>
                  )}

                  {/* Pulsanti di azione per admin/coordinator */}
                  {isAdmin && (
                    <div style={{ 
                      marginTop: '16px', 
                      padding: '16px', 
                      background: '#f8fafc', 
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}>
                      {richiesta.stato === 'in_attesa' && (
                        <>
                          <button
                            onClick={() => {
                              const itemsConAutorizzazione = richiesta.items.map(item => ({
                                supplyId: item.supplyId || item._id,
                                quantitaAutorizzata: item.quantitaRichiesta,
                                statoItem: 'autorizzato'
                              }));
                              gestisciRichiesta(richiesta._id, itemsConAutorizzazione, 'Richiesta autorizzata automaticamente');
                            }}
                            style={{
                              padding: '8px 16px',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            ✅ Conferma Richiesta
                          </button>
                          <button
                            onClick={() => {
                              const motivo = prompt('Motivo del rifiuto (opzionale):');
                              if (motivo !== null) {
                                const itemsRifiutati = richiesta.items.map(item => ({
                                  supplyId: item.supplyId || item._id,
                                  quantitaAutorizzata: 0,
                                  statoItem: 'rifiutato'
                                }));
                                gestisciRichiesta(richiesta._id, itemsRifiutati, motivo || undefined);
                              }
                            }}
                            style={{
                              padding: '8px 16px',
                              background: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            ❌ Rifiuta Richiesta
                          </button>
                        </>
                      )}
                      
                      {richiesta.stato === 'gestita' && (
                        <button
                          onClick={() => segnaComeConsegnato(richiesta._id)}
                          style={{
                            padding: '8px 16px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          🚚 Segna come Consegnato
                        </button>
                      )}
                      
                      <button
                        onClick={() => eliminaRichiesta(richiesta._id)}
                        style={{
                          padding: '8px 16px',
                          background: '#6b7280',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ Elimina Richiesta
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Riepilogo consegne */}
      {activeTab === 'consegne' && !loading && consegneFiltrate.length > 0 && (
        <div style={{ 
          marginTop: '32px', 
          padding: '20px', 
          background: '#f1f5f9', 
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>Totale consegne</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e4d8c' }}>{consegneFiltrate.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>Operatori coinvolti</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e4d8c' }}>
              {new Set(consegneFiltrate.map(c => c.operatoreId)).size}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>Totale articoli</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e4d8c' }}>
              {consegneFiltrate.reduce((sum, c) => sum + c.items.length, 0)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
