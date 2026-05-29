import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import FarmaciSection from '../components/FarmaciSection';
import api from '../api/api';
import GestioneRichiestePresidi from '../components/GestioneRichiestePresidi';

// Interfacce per le apparecchiature elettromedicali
interface Apparecchiatura {
  _id?: string;
  id: string;
  tipo: string;
  matricola: string;
  controlloEseguito: boolean;
  dataControllo: string;
}

// Interfacce per i documenti delle apparecchiature
interface EquipmentDocument {
  _id: string;
  equipment: string;
  documentType: 'conformita' | 'manutenzione' | 'manuale';
  fileName: string;
  contentType: string;
  createdAt: string;
  updatedAt: string;
}

// Interfacce per i presidi sanitari
interface PresidioSanitario {
  _id?: string;
  id: string;
  nome: string;
  quantita: number;
  scadenza: string;
  unitaMisura?: string;
  scortaMinima?: number;
}

// Interfaccia per i movimenti di magazzino
interface SupplyMovement {
  _id: string;
  supply: string;
  tipo: 'carico' | 'scarico';
  quantita: number;
  motivazione?: string;
  eseguitoDaNome?: string;
  dataMovimento: string;
  quantitaPrecedente: number;
  quantitaSuccessiva: number;
}

// Etichette per i tipi di documento
const documentTypeLabels: Record<string, string> = {
  conformita: 'Certificato di conformità',
  manutenzione: 'Libretto di manutenzione',
  manuale: "Manuale d'uso",
};

// Colori per i tipi di documento
const documentTypeColors: Record<string, string> = {
  conformita: '#28a745',
  manutenzione: '#17a2b8',
  manuale: '#6c757d',
};

function Strumenti() {
  const { user, getToken } = useAuth();
  const [apparecchiature, setApparecchiature] = useState<Apparecchiatura[]>([]);
  const [presidi, setPresidi] = useState<PresidioSanitario[]>([]);
  const [loading, setLoading] = useState(true);

  // Stato per la gestione dei documenti
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [documents, setDocuments] = useState<EquipmentDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stato per la gestione movimenti presidi
  const [selectedPresidio, setSelectedPresidio] = useState<PresidioSanitario | null>(null);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<'carico' | 'scarico'>('carico');
  const [movementQuantity, setMovementQuantity] = useState<number>(1);
  const [movementNote, setMovementNote] = useState('');
  const [movementScadenza, setMovementScadenza] = useState('');
  const [movements, setMovements] = useState<SupplyMovement[]>([]);
  const [cercaPresidio, setCercaPresidio] = useState('');

  // Form stati per le apparecchiature
  const [nuovaApparecchiatura, setNuovaApparecchiatura] = useState({
    tipo: '',
    matricola: '',
    controlloEseguito: false,
    dataControllo: '',
  });

  // Stato per modifica apparecchiatura
  const [editingApparecchiatura, setEditingApparecchiatura] = useState<Apparecchiatura | null>(null);
  const [editAppForm, setEditAppForm] = useState({
    tipo: '',
    matricola: '',
    controlloEseguito: false,
    dataControllo: '',
  });

  // Form stati per i presidi sanitari
  const [nuovoPresidio, setNuovoPresidio] = useState({
    nome: '',
    quantita: 0,
    scadenza: '',
    unitaMisura: 'pezzi',
    scortaMinima: 0,
  });

  // Stato per modifica presidio
  const [editingPresidio, setEditingPresidio] = useState<PresidioSanitario | null>(null);
  const [editPresForm, setEditPresForm] = useState({
    nome: '',
    scadenza: '',
    unitaMisura: 'pezzi',
    scortaMinima: 0,
  });

  useEffect(() => {
    fetchApparecchiature();
    fetchPresidi();
  }, []);

  const fetchApparecchiature = async () => {
    try {
      const res = await api.get('/equipment');
      setApparecchiature(res.data.map((item: any) => ({ ...item, id: item._id || item.id })));
    } catch (err) {
      console.warn('Errore nel caricamento delle apparecchiature:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPresidi = async () => {
    try {
      const res = await api.get('/supplies');
      setPresidi(res.data.map((item: any) => ({ ...item, id: item._id || item.id })));
    } catch (err) {
      console.warn('Errore nel caricamento dei presidi:', err);
    }
  };

  const fetchDocuments = async (equipmentId: string) => {
    try {
      const res = await api.get(`/equipment/${equipmentId}/documents`);
      setDocuments(res.data);
    } catch (err) {
      console.error('Errore nel caricamento documenti:', err);
    }
  };

  const fetchMovements = async (supplyId: string) => {
    try {
      const res = await api.get(`/supplies/${supplyId}/movements`);
      setMovements(res.data);
    } catch (err) {
      console.error('Errore nel caricamento movimenti:', err);
    }
  };

  const formatData = (data: string | Date) => {
    if (!data) return 'N/A';
    return new Date(data).toLocaleDateString('it-IT');
  };

  const formatDataOra = (data: string | Date) => {
    if (!data) return 'N/A';
    return new Date(data).toLocaleString('it-IT');
  };

  const eScadutoOProssimo = (scadenza: string) => {
    const oggi = new Date();
    const dataScadenza = new Date(scadenza);
    const differenzaGiorni = Math.ceil((dataScadenza.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24));
    return differenzaGiorni <= 30;
  };

  // Restituisce true se scade entro 10 giorni (ma non ancora scaduto)
  const eInScadenzaBreve = (scadenza: string) => {
    const oggi = new Date();
    const dataScadenza = new Date(scadenza);
    const differenzaGiorni = Math.ceil((dataScadenza.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24));
    return differenzaGiorni >= 0 && differenzaGiorni <= 10;
  };

  // Restituisce true se già scaduto
  const eScaduto = (scadenza: string) => {
    return new Date(scadenza) < new Date();
  };

  // Aggiungere nuova apparecchiatura
  const aggiungiApparecchiatura = async () => {
    if (!nuovaApparecchiatura.tipo || !nuovaApparecchiatura.matricola) {
      alert('Inserire tipo e matricola');
      return;
    }
    try {
      const res = await api.post('/equipment', nuovaApparecchiatura);
      setApparecchiature([...apparecchiature, { ...res.data, id: res.data._id }]);
      setNuovaApparecchiatura({ tipo: '', matricola: '', controlloEseguito: false, dataControllo: '' });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Errore di connessione';
      alert(msg);
    }
  };

  // Eliminare apparecchiatura
  const eliminaApparecchiatura = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa apparecchiatura e tutti i suoi documenti?')) return;
    try {
      await api.delete(`/equipment/${id}`);
      setApparecchiature(apparecchiature.filter((a) => a.id !== id));
      if (selectedEquipment === id) {
        setShowDocumentsModal(false);
        setSelectedEquipment(null);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore di connessione');
    }
  };

  // Apri modal modifica apparecchiatura
  const apriModificaApparecchiatura = (app: Apparecchiatura) => {
    setEditingApparecchiatura(app);
    setEditAppForm({
      tipo: app.tipo,
      matricola: app.matricola,
      controlloEseguito: app.controlloEseguito,
      dataControllo: app.dataControllo ? app.dataControllo.substring(0, 10) : '',
    });
  };

  const chiudiModificaApparecchiatura = () => {
    setEditingApparecchiatura(null);
  };

  const salvaModificaApparecchiatura = async () => {
    if (!editingApparecchiatura) return;
    if (!editAppForm.tipo || !editAppForm.matricola) {
      alert('Tipo e matricola sono obbligatori');
      return;
    }
    try {
      const res = await api.put(`/equipment/${editingApparecchiatura.id}`, {
        tipo: editAppForm.tipo,
        matricola: editAppForm.matricola,
        controlloEseguito: editAppForm.controlloEseguito,
        dataControllo: editAppForm.controlloEseguito ? editAppForm.dataControllo : null,
      });
      setApparecchiature(apparecchiature.map(a =>
        a.id === editingApparecchiatura.id ? { ...res.data, id: res.data._id } : a
      ));
      setEditingApparecchiatura(null);
      alert('Apparecchiatura aggiornata con successo!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore di connessione');
    }
  };

  // Aggiungere nuovo presidio
  const aggiungiPresidio = async () => {
    if (!nuovoPresidio.nome) {
      alert('Inserire nome del presidio');
      return;
    }
    try {
      const res = await api.post('/supplies', nuovoPresidio);
      setPresidi([...presidi, { ...res.data, id: res.data._id }]);
      setNuovoPresidio({ nome: '', quantita: 0, scadenza: '', unitaMisura: 'pezzi', scortaMinima: 0 });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Errore di connessione';
      alert(msg);
    }
  };

  // Eliminare presidio
  const eliminaPresidio = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo presidio?')) return;
    try {
      await api.delete(`/supplies/${id}`);
      setPresidi(presidi.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore di connessione');
    }
  };

  // Apri modal modifica presidio
  const apriModificaPresidio = (presidio: PresidioSanitario) => {
    setEditingPresidio(presidio);
    setEditPresForm({
      nome: presidio.nome,
      scadenza: presidio.scadenza ? presidio.scadenza.substring(0, 10) : '',
      unitaMisura: presidio.unitaMisura || 'pezzi',
      scortaMinima: presidio.scortaMinima || 0,
    });
  };

  const chiudiModificaPresidio = () => {
    setEditingPresidio(null);
  };

  const salvaModificaPresidio = async () => {
    if (!editingPresidio) return;
    if (!editPresForm.nome) {
      alert('Il nome è obbligatorio');
      return;
    }
    try {
      const res = await api.put(`/supplies/${editingPresidio.id}`, {
        nome: editPresForm.nome,
        scadenza: editPresForm.scadenza || null,
        unitaMisura: editPresForm.unitaMisura,
        scortaMinima: editPresForm.scortaMinima,
      });
      setPresidi(presidi.map(p =>
        p.id === editingPresidio.id ? { ...res.data, id: res.data._id } : p
      ));
      setEditingPresidio(null);
      alert('Presidio aggiornato con successo!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore di connessione');
    }
  };

  // Effettua movimento di magazzino
  const eseguiMovimento = async () => {
    if (!selectedPresidio) return;
    if (movementQuantity <= 0) { alert('Inserire una quantità valida'); return; }
    if (movementType === 'scarico' && movementQuantity > selectedPresidio.quantita) {
      alert(`Quantità insufficiente. Disponibilità: ${selectedPresidio.quantita} ${selectedPresidio.unitaMisura || 'pezzi'}`);
      return;
    }
    try {
      const payload: any = {
        tipo: movementType,
        quantita: movementQuantity,
        motivazione: movementNote,
        nuovaScadenza: movementScadenza || null,
      };
      const res = await api.post(`/supplies/${selectedPresidio.id}/movements`, payload);
      const nuovaScadenzaAggiornata = res.data.supply.scadenza || '';
      // Aggiorna la lista presidi con nuova quantità e nuova scadenza
      setPresidi(presidi.map(p =>
        p.id === selectedPresidio.id
          ? { ...p, quantita: res.data.supply.quantita, scadenza: nuovaScadenzaAggiornata }
          : p
      ));
      // Aggiorna anche il presidio selezionato nel modal
      setSelectedPresidio(prev => prev ? { ...prev, quantita: res.data.supply.quantita, scadenza: nuovaScadenzaAggiornata } : prev);
      await fetchMovements(selectedPresidio.id);
      setMovementQuantity(1);
      setMovementNote('');
      alert(`Movimento registrato! Nuova quantità: ${res.data.supply.quantita} ${selectedPresidio.unitaMisura || 'pezzi'}`);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore di connessione');
    }
  };

  const apriDocumenti = async (equipmentId: string) => {
    setSelectedEquipment(equipmentId);
    await fetchDocuments(equipmentId);
    setShowDocumentsModal(true);
  };

  const chiudiDocumenti = () => {
    setShowDocumentsModal(false);
    setSelectedEquipment(null);
    setDocuments([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const apriMovimenti = async (presidio: PresidioSanitario) => {
    setSelectedPresidio(presidio);
    setMovementType('carico');
    setMovementQuantity(1);
    setMovementNote('');
    setMovementScadenza(presidio.scadenza ? presidio.scadenza.substring(0, 10) : '');
    await fetchMovements(presidio.id);
    setShowMovementModal(true);
  };

  const chiudiMovimenti = () => {
    setShowMovementModal(false);
    setSelectedPresidio(null);
    setMovements([]);
  };

  // Carica un documento
  const caricaDocumento = async (documentType: 'conformita' | 'manutenzione' | 'manuale') => {
    const fileInput = fileInputRef.current;
    if (!fileInput?.files?.length) { alert('Seleziona un file da caricare'); return; }
    const file = fileInput.files[0];
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) { alert('Tipo di file non consentito. Usa PDF, immagini (JPG, PNG) o documenti Word.'); return; }
    if (file.size > 20 * 1024 * 1024) { alert('File troppo grande. Dimensione massima: 20MB'); return; }
    if (!selectedEquipment) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', documentType);
      await api.post(`/equipment/${selectedEquipment}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchDocuments(selectedEquipment);
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert('Documento caricato con successo!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore nel caricamento del documento');
    } finally {
      setUploading(false);
    }
  };

  // Scarica un documento
  const scaricaDocumento = async (documentId: string, fileName: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const baseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/$/, '');
      const url = baseURL.endsWith('/api') ? `${baseURL}/equipment/documents/${documentId}` : `${baseURL}/api/equipment/documents/${documentId}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert('Errore nel download del documento');
      }
    } catch (err) {
      alert('Errore di connessione');
    }
  };

  // Elimina un documento
  const eliminaDocumento = async (documentId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo documento?')) return;
    try {
      await api.delete(`/equipment/documents/${documentId}`);
      await fetchDocuments(selectedEquipment!);
      alert('Documento eliminato con successo!');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Errore di connessione');
    }
  };

  // Stampa PDF apparecchiature
  const stampaPDFApparecchiature = () => {
    const oggi = new Date().toLocaleDateString('it-IT');
    const righe = apparecchiature.map(a => {
      const controllo = a.controlloEseguito
        ? `<span style="color:#28a745;font-weight:bold;">✓ Sì — ${a.dataControllo ? formatData(a.dataControllo) : 'N/A'}</span>`
        : `<span style="color:#dc3545;font-weight:bold;">✗ Da fare</span>`;
      return `
        <tr>
          <td>${a.tipo}</td>
          <td>${a.matricola}</td>
          <td>${controllo}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <title>Elenco Apparecchiature Elettromedicali</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #222; }
    .intestazione { display: flex; align-items: center; gap: 20px; border-bottom: 3px solid #2c5f8a; padding-bottom: 14px; margin-bottom: 18px; }
    .intestazione img { height: 70px; width: auto; }
    .intestazione .testo h1 { margin: 0; font-size: 20px; color: #2c5f8a; }
    .intestazione .testo p { margin: 3px 0 0; font-size: 12px; color: #666; }
    .subtitle { color: #666; font-size: 13px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #2c5f8a; color: #fff; padding: 8px 10px; text-align: left; }
    td { padding: 7px 10px; border-bottom: 1px solid #ddd; vertical-align: middle; }
    tr:nth-child(even) td { background: #f5f8fc; }
    .footer { margin-top: 20px; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 8px; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <div class="intestazione">
    <img src="${window.location.origin}/logo.jpg" alt="Abbraccio Cure Domiciliari" onerror="this.style.display='none'" />
    <div class="testo">
      <h1>⚙️ Elenco Apparecchiature Elettromedicali</h1>
      <p>Abbraccio Cure Domiciliari — Documento generato il ${oggi}</p>
    </div>
  </div>
  <div class="subtitle">Totale: ${apparecchiature.length} apparecchiature in elenco</div>
  <table>
    <thead>
      <tr>
        <th>Tipo apparecchiatura</th>
        <th>Matricola / N° serie</th>
        <th>Controllo eseguito</th>
      </tr>
    </thead>
    <tbody>${righe}</tbody>
  </table>
  <div class="footer">Documento generato automaticamente da Abbraccio Cure Domiciliari</div>
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

  // Stampa PDF presidi
  const stampaPDFPresidi = () => {
    const oggi = new Date().toLocaleDateString('it-IT');
    const righe = presidi.map(p => {
      const unita = p.unitaMisura || 'pezzi';
      const sottoScorta = p.scortaMinima && p.quantita < p.scortaMinima;
      const mancanti = sottoScorta ? (p.scortaMinima! - p.quantita) : 0;
      const scad = p.scadenza ? formatData(p.scadenza) : 'N/A';
      const pScaduto = p.scadenza && eScaduto(p.scadenza);
      const pInScadenzaBreve = p.scadenza && !pScaduto && eInScadenzaBreve(p.scadenza);
      const scadStyle = pScaduto
        ? 'color:#dc3545;font-weight:bold;'
        : pInScadenzaBreve
          ? 'color:#856404;font-weight:bold;background:#fff3cd;padding:2px 4px;border-radius:3px;'
          : '';
      const scadLabel = pScaduto
        ? `🔴 SCADUTO: ${scad}`
        : pInScadenzaBreve
          ? `🟡 SCADE TRA POCO: ${scad} (⚠️ entro 10gg)`
          : scad;
      return `
        <tr>
          <td>${p.nome}</td>
          <td style="text-align:center;${sottoScorta ? 'color:#dc3545;font-weight:bold;' : ''}">${p.quantita} ${unita}${sottoScorta ? ' ⚠️ SOTTO SCORTA' : ''}</td>
          <td style="${scadStyle}">${scadLabel}</td>
          <td style="text-align:center;">${p.scortaMinima || 0} ${unita}</td>
          <td style="text-align:center;${sottoScorta ? 'color:#dc3545;font-weight:bold;' : 'color:#28a745;'}">${sottoScorta ? `⚠️ mancano ${mancanti} ${unita}` : '✅ OK'}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <title>Elenco Presidi Sanitari</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #222; }
    .intestazione { display: flex; align-items: center; gap: 20px; border-bottom: 3px solid #2c5f8a; padding-bottom: 14px; margin-bottom: 18px; }
    .intestazione img { height: 70px; width: auto; }
    .intestazione .testo h1 { margin: 0; font-size: 20px; color: #2c5f8a; }
    .intestazione .testo p { margin: 3px 0 0; font-size: 12px; color: #666; }
    .subtitle { color: #666; font-size: 13px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #2c5f8a; color: #fff; padding: 8px 10px; text-align: left; }
    td { padding: 7px 10px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) td { background: #f5f8fc; }
    .footer { margin-top: 20px; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 8px; }
    @media print { body { margin: 10mm; } }
  </style>
</head>
<body>
  <div class="intestazione">
    <img src="${window.location.origin}/logo.jpg" alt="Abbraccio Cure Domiciliari" onerror="this.style.display='none'" />
    <div class="testo">
      <h1>🏥 Elenco Presidi Sanitari</h1>
      <p>Abbraccio Cure Domiciliari — Documento generato il ${oggi}</p>
    </div>
  </div>
  <div class="subtitle">Totale: ${presidi.length} presidi in elenco</div>
  <table>
    <thead>
      <tr>
        <th>Nome presidio</th>
        <th>Quantità</th>
        <th>Scadenza</th>
        <th>Scorta minima</th>
        <th>Differenza</th>
      </tr>
    </thead>
    <tbody>${righe}</tbody>
  </table>
  <div class="footer">Documento generato automaticamente da Abbraccio Cure Domiciliari</div>
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

  const canEdit = !!(user);

  return (
    <section>
      <h2>Strumenti e Presidi</h2>

      {/* Sezione Apparecchiature Elettromedicali */}
      <div className="dashboard-folder" style={{ marginBottom: '32px' }}>
        <h3>Apparecchiature Elettromedicali</h3>

        {loading ? (
          <p>Caricamento apparecchiature...</p>
        ) : (
          <>
            {canEdit && (
              <div className="user-form" style={{ marginBottom: '20px', maxWidth: '500px' }}>
                <h4>Aggiungi nuova apparecchiatura</h4>
                <label>
                  Tipo apparecchiatura
                  <input
                    type="text"
                    value={nuovaApparecchiatura.tipo}
                    onChange={(e) => setNuovaApparecchiatura({ ...nuovaApparecchiatura, tipo: e.target.value })}
                    placeholder="Es. Elettrocardiografo"
                  />
                </label>
                <label>
                  Matricola / N° serie
                  <input
                    type="text"
                    value={nuovaApparecchiatura.matricola}
                    onChange={(e) => setNuovaApparecchiatura({ ...nuovaApparecchiatura, matricola: e.target.value })}
                    placeholder="Es. ECG-2024-001"
                  />
                </label>
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={nuovaApparecchiatura.controlloEseguito}
                    onChange={(e) => setNuovaApparecchiatura({ ...nuovaApparecchiatura, controlloEseguito: e.target.checked })}
                    style={{ width: 'auto' }}
                  />
                  Controllo eseguito
                </label>
                {nuovaApparecchiatura.controlloEseguito && (
                  <label>
                    Data controllo
                    <input
                      type="date"
                      value={nuovaApparecchiatura.dataControllo}
                      onChange={(e) => setNuovaApparecchiatura({ ...nuovaApparecchiatura, dataControllo: e.target.value })}
                    />
                  </label>
                )}
                <button type="button" onClick={aggiungiApparecchiatura}>
                  Aggiungi apparecchiatura
                </button>
              </div>
            )}

            {apparecchiature.length > 0 ? (
              <div className="document-list">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ margin: 0 }}>Elenco apparecchiature ({apparecchiature.length})</h4>
                  <button type="button" onClick={stampaPDFApparecchiature} style={{ background: '#6c757d', fontSize: '0.85rem', padding: '6px 14px' }}>
                    🖨️ Stampa lista PDF
                  </button>
                </div>
                <ul>
                  {apparecchiature.map((apparecchiatura) => (
                    <li key={apparecchiatura.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <strong>{apparecchiatura.tipo}</strong>
                          <span style={{ marginLeft: '12px', color: '#666' }}>Matricola: {apparecchiatura.matricola}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {apparecchiatura.controlloEseguito ? (
                            <span style={{ color: '#28a745', fontWeight: '600' }}>
                              ✓ Controllato il {formatData(apparecchiatura.dataControllo)}
                            </span>
                          ) : (
                            <span style={{ color: '#dc3545', fontWeight: '600' }}>✗ Da controllare</span>
                          )}
                          <button type="button" onClick={() => apriDocumenti(apparecchiatura.id)} style={{ background: '#17a2b8' }}>
                            📎 Documenti
                          </button>
                          {canEdit && (
                            <>
                              <button type="button" onClick={() => apriModificaApparecchiatura(apparecchiatura)} style={{ background: '#fd7e14' }}>
                                ✏️ Modifica
                              </button>
                              <button type="button" onClick={() => eliminaApparecchiatura(apparecchiatura.id)} style={{ background: '#dc3545' }}>
                                Elimina
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p>Nessuna apparecchiatura presente.</p>
            )}
          </>
        )}
      </div>

      {/* Sezione Farmaci */}
      <FarmaciSection
        getToken={getToken}
        canEdit={canEdit}
        formatData={formatData}
        formatDataOra={formatDataOra}
        eScadutoOProssimo={eScadutoOProssimo}
      />

      {/* Sezione Presidi Sanitari */}
      <div className="dashboard-folder">
        <h3>Presidi Sanitari</h3>

        {canEdit && (
          <div className="user-form" style={{ marginBottom: '20px', maxWidth: '500px' }}>
            <h4>Aggiungi nuovo presidio</h4>
            <label>
              Nome presidio
              <input
                type="text"
                value={nuovoPresidio.nome}
                onChange={(e) => setNuovoPresidio({ ...nuovoPresidio, nome: e.target.value })}
                placeholder="Es. Garze sterili 10x10"
              />
            </label>
            <label>
              Quantità iniziale
              <input
                type="number"
                min="0"
                value={nuovoPresidio.quantita}
                onChange={(e) => setNuovoPresidio({ ...nuovoPresidio, quantita: parseInt(e.target.value) || 0 })}
              />
            </label>
            <label>
              Unità di misura
              <select value={nuovoPresidio.unitaMisura} onChange={(e) => setNuovoPresidio({ ...nuovoPresidio, unitaMisura: e.target.value })}>
                <option value="pezzi">Pezzi</option>
                <option value="confezioni">Confezioni</option>
                <option value="scatole">Scatole</option>
                <option value="ml">Metri lineari</option>
                <option value="kg">Kg</option>
                <option value="l">Litri</option>
              </select>
            </label>
            <label>
              Scadenza
              <input
                type="date"
                value={nuovoPresidio.scadenza}
                onChange={(e) => setNuovoPresidio({ ...nuovoPresidio, scadenza: e.target.value })}
              />
            </label>
            <label>
              Scorta minima (opzionale)
              <input
                type="number"
                min="0"
                value={nuovoPresidio.scortaMinima}
                onChange={(e) => setNuovoPresidio({ ...nuovoPresidio, scortaMinima: parseInt(e.target.value) || 0 })}
              />
            </label>
            <button type="button" onClick={aggiungiPresidio}>
              Aggiungi presidio
            </button>
          </div>
        )}

        {presidi.length > 0 ? (
          <div className="document-list">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <h4 style={{ margin: 0 }}>Elenco presidi ({presidi.length})</h4>
              <button type="button" onClick={stampaPDFPresidi} style={{ background: '#6c757d', fontSize: '0.85rem', padding: '6px 14px' }}>
                🖨️ Stampa lista PDF
              </button>
            </div>
            {/* Barra di ricerca presidi */}
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🔍</span>
              <input
                type="text"
                value={cercaPresidio}
                onChange={(e) => setCercaPresidio(e.target.value)}
                placeholder="Cerca presidio per nome..."
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #ced4da', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
              />
              {cercaPresidio && (
                <button
                  type="button"
                  onClick={() => setCercaPresidio('')}
                  style={{ background: 'none', border: 'none', color: '#6c757d', cursor: 'pointer', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}
                  title="Cancella ricerca"
                >
                  ×
                </button>
              )}
            </div>
            {cercaPresidio && (
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#666' }}>
                {presidi.filter(p => p.nome.toLowerCase().includes(cercaPresidio.toLowerCase())).length} risultati per "{cercaPresidio}"
              </p>
            )}
            <ul>
              {presidi.filter(p => !cercaPresidio || p.nome.toLowerCase().includes(cercaPresidio.toLowerCase())).map((presidio) => {
                const unita = presidio.unitaMisura || 'pezzi';
                const sottoScorta = presidio.scortaMinima && presidio.quantita < presidio.scortaMinima;
                const mancanti = sottoScorta ? (presidio.scortaMinima! - presidio.quantita) : 0;
                const scaduto = presidio.scadenza && eScaduto(presidio.scadenza);
                const inScadenzaBreve = presidio.scadenza && !scaduto && eInScadenzaBreve(presidio.scadenza);
                return (
                  <li key={presidio.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <strong>{presidio.nome}</strong>
                        <span style={{ marginLeft: '12px', color: '#666' }}>
                          Qta: <span style={{ fontWeight: '700', color: sottoScorta ? '#dc3545' : '#28a745', fontSize: '1.1em' }}>{presidio.quantita}</span> {unita}
                          {sottoScorta && <span style={{ color: '#dc3545', fontWeight: '600', marginLeft: '8px' }}>⚠️ Sotto scorta! (mancano {mancanti} {unita})</span>}
                        </span>
                        {presidio.scadenza && (
                          <span
                            style={{
                              marginLeft: '12px',
                              fontWeight: (scaduto || inScadenzaBreve) ? '700' : 'normal',
                              color: scaduto ? '#dc3545' : inScadenzaBreve ? '#856404' : '#666',
                              background: inScadenzaBreve ? '#fff3cd' : scaduto ? 'rgba(220,53,69,0.08)' : 'transparent',
                              border: inScadenzaBreve ? '1px solid #ffc107' : scaduto ? '1px solid #dc3545' : 'none',
                              borderRadius: '4px',
                              padding: (scaduto || inScadenzaBreve) ? '2px 7px' : '0',
                              display: 'inline-block',
                            }}
                          >
                            {scaduto ? '🔴 SCADUTO: ' : inScadenzaBreve ? '🟡 SCADE TRA POCO: ' : 'Scad.: '}
                            {formatData(presidio.scadenza)}
                            {inScadenzaBreve && ' (⚠️ entro 10 giorni)'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button type="button" onClick={() => apriMovimenti(presidio)} style={{ background: '#17a2b8' }}>
                          📦 Movimenti
                        </button>
                        {canEdit && (
                          <>
                            <button type="button" onClick={() => apriModificaPresidio(presidio)} style={{ background: '#fd7e14' }}>
                              ✏️ Modifica
                            </button>
                            <button type="button" onClick={() => eliminaPresidio(presidio.id)} style={{ background: '#dc3545' }}>
                              Elimina
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p>Nessun presidio presente.</p>
        )}
      </div>

      {/* Modal modifica apparecchiatura */}
      {editingApparecchiatura && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '500px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>✏️ Modifica Apparecchiatura</h3>
              <button type="button" onClick={chiudiModificaApparecchiatura} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: '600' }}>Tipo apparecchiatura *</span>
                <input type="text" value={editAppForm.tipo} onChange={(e) => setEditAppForm({ ...editAppForm, tipo: e.target.value })} style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: '600' }}>Matricola / N° serie *</span>
                <input type="text" value={editAppForm.matricola} onChange={(e) => setEditAppForm({ ...editAppForm, matricola: e.target.value })} style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" checked={editAppForm.controlloEseguito} onChange={(e) => setEditAppForm({ ...editAppForm, controlloEseguito: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
                <span style={{ fontWeight: '600' }}>Controllo eseguito</span>
              </label>
              {editAppForm.controlloEseguito && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontWeight: '600' }}>Data controllo</span>
                  <input type="date" value={editAppForm.dataControllo} onChange={(e) => setEditAppForm({ ...editAppForm, dataControllo: e.target.value })} style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }} />
                </label>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button type="button" onClick={salvaModificaApparecchiatura} style={{ flex: 1, background: '#28a745', padding: '10px', fontSize: '15px' }}>💾 Salva modifiche</button>
              <button type="button" onClick={chiudiModificaApparecchiatura} style={{ flex: 1, background: '#6c757d', padding: '10px', fontSize: '15px' }}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal modifica presidio */}
      {editingPresidio && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '500px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>✏️ Modifica Presidio</h3>
              <button type="button" onClick={chiudiModificaPresidio} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: '600' }}>Nome presidio *</span>
                <input type="text" value={editPresForm.nome} onChange={(e) => setEditPresForm({ ...editPresForm, nome: e.target.value })} style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: '600' }}>Data scadenza</span>
                <input type="date" value={editPresForm.scadenza} onChange={(e) => setEditPresForm({ ...editPresForm, scadenza: e.target.value })} style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: '600' }}>Unità di misura</span>
                <select value={editPresForm.unitaMisura} onChange={(e) => setEditPresForm({ ...editPresForm, unitaMisura: e.target.value })} style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }}>
                  <option value="pezzi">Pezzi</option>
                  <option value="confezioni">Confezioni</option>
                  <option value="scatole">Scatole</option>
                  <option value="ml">Metri lineari</option>
                  <option value="kg">Kg</option>
                  <option value="l">Litri</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: '600' }}>Scorta minima</span>
                <input type="number" min="0" value={editPresForm.scortaMinima} onChange={(e) => setEditPresForm({ ...editPresForm, scortaMinima: parseInt(e.target.value) || 0 })} style={{ padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button type="button" onClick={salvaModificaPresidio} style={{ flex: 1, background: '#28a745', padding: '10px', fontSize: '15px' }}>💾 Salva modifiche</button>
              <button type="button" onClick={chiudiModificaPresidio} style={{ flex: 1, background: '#6c757d', padding: '10px', fontSize: '15px' }}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal documenti apparecchiature */}
      {showDocumentsModal && selectedEquipment && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '700px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Gestione Documenti</h3>
              <button type="button" onClick={chiudiDocumenti} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>×</button>
            </div>
            {(() => {
              const eq = apparecchiature.find(a => a.id === selectedEquipment);
              return eq ? (
                <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <strong>{eq.tipo}</strong>
                  <span style={{ marginLeft: '12px', color: '#666' }}>Matricola: {eq.matricola}</span>
                </div>
              ) : null;
            })()}
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
            {canEdit && (
              <div style={{ marginBottom: '24px', padding: '16px', border: '2px dashed #dee2e6', borderRadius: '4px' }}>
                <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Carica nuovo documento</h4>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '8px' }}>1. Seleziona il file (PDF, JPG, PNG, DOC, DOCX - max 20MB)</label>
                  <button type="button" onClick={() => fileInputRef.current?.click()} style={{ background: '#6c757d' }}>Scegli file...</button>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '8px' }}>2. Seleziona il tipo di documento</label>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {(['conformita', 'manutenzione', 'manuale'] as const).map((type) => (
                      <button key={type} type="button" onClick={() => caricaDocumento(type)} disabled={uploading} style={{ background: documentTypeColors[type], opacity: uploading ? 0.6 : 1 }}>
                        {uploading ? 'Caricamento...' : documentTypeLabels[type]}
                      </button>
                    ))}
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Nota: se esiste già un documento dello stesso tipo, verrà sostituito.</p>
              </div>
            )}
            <div>
              <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Documenti archiviati</h4>
              {documents.length === 0 ? (
                <p style={{ color: '#666', fontStyle: 'italic' }}>Nessun documento caricato per questa apparecchiatura.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {documents.map((doc) => (
                    <div key={doc._id} style={{ display: 'flex', alignItems: 'center', padding: '12px', border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#f8f9fa' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', backgroundColor: documentTypeColors[doc.documentType], color: '#fff', fontSize: '12px', fontWeight: '600' }}>
                            {documentTypeLabels[doc.documentType]}
                          </span>
                          <strong>{doc.fileName}</strong>
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>Caricato il: {formatData(doc.createdAt)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" onClick={() => scaricaDocumento(doc._id, doc.fileName)} style={{ background: '#28a745' }}>⬇ Scarica</button>
                        {canEdit && <button type="button" onClick={() => eliminaDocumento(doc._id)} style={{ background: '#dc3545' }}>Elimina</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal movimenti presidi */}
      {showMovementModal && selectedPresidio && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', maxWidth: '700px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Gestione Movimenti - {selectedPresidio.nome}</h3>
              <button type="button" onClick={chiudiMovimenti} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>×</button>
            </div>
            <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ color: '#666' }}>Quantità attuale: </span>
                <strong style={{ fontSize: '1.2em', color: '#28a745' }}>{selectedPresidio.quantita} {selectedPresidio.unitaMisura || 'pezzi'}</strong>
              </div>
              {selectedPresidio.scadenza && (
                <div><span style={{ color: '#666' }}>Scadenza: </span><strong>{formatData(selectedPresidio.scadenza)}</strong></div>
              )}
            </div>
            <div style={{ marginBottom: '24px', padding: '16px', border: '2px dashed #dee2e6', borderRadius: '4px', backgroundColor: '#f8f9fa' }}>
              <h4 style={{ marginTop: 0, marginBottom: '16px' }}>Nuovo Movimento</h4>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Tipo movimento</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={() => setMovementType('carico')} style={{ flex: 1, background: movementType === 'carico' ? '#28a745' : '#6c757d', padding: '10px' }}>⬆ Carico</button>
                    <button type="button" onClick={() => setMovementType('scarico')} style={{ flex: 1, background: movementType === 'scarico' ? '#dc3545' : '#6c757d', padding: '10px' }}>⬇ Scarico</button>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Quantità ({selectedPresidio.unitaMisura || 'pezzi'})</label>
                  <input type="number" min="1" value={movementQuantity} onChange={(e) => setMovementQuantity(parseInt(e.target.value) || 1)} style={{ width: '100%', padding: '10px', fontSize: '16px' }} />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Motivazione (opzionale)</label>
                <input type="text" value={movementNote} onChange={(e) => setMovementNote(e.target.value)} placeholder={movementType === 'carico' ? 'Es. Fornitura, acquisto...' : 'Es. Consegnato a reparto, scaduto...'} style={{ width: '100%', padding: '10px' }} />
              </div>
              <div style={{ marginBottom: '16px', padding: '12px', background: '#e8f4fd', border: '1px solid #bee3f8', borderRadius: '6px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#1e4d8c' }}>
                  📅 Aggiorna data di scadenza (opzionale)
                </label>
                <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#555' }}>
                  Lascia vuoto per mantenere la scadenza attuale
                  {selectedPresidio.scadenza ? ` (${formatData(selectedPresidio.scadenza)})` : ' (nessuna scadenza impostata)'}.
                </p>
                <input
                  type="date"
                  value={movementScadenza}
                  onChange={(e) => setMovementScadenza(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }}
                />
                {movementScadenza && (
                  <button
                    type="button"
                    onClick={() => setMovementScadenza('')}
                    style={{ marginTop: '6px', background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '12px', padding: 0 }}
                  >
                    ✕ Rimuovi data scadenza
                  </button>
                )}
              </div>
              {movementType === 'scarico' && (
                <div style={{ padding: '10px', backgroundColor: movementQuantity > selectedPresidio.quantita ? '#f8d7da' : '#d4edda', borderRadius: '4px', marginBottom: '16px', color: movementQuantity > selectedPresidio.quantita ? '#721c24' : '#155724' }}>
                  {movementQuantity > selectedPresidio.quantita ? <strong>⚠️ Quantità insufficiente!</strong> : `Nuova quantità dopo scarico: ${selectedPresidio.quantita - movementQuantity} ${selectedPresidio.unitaMisura || 'pezzi'}`}
                </div>
              )}
              {movementType === 'carico' && (
                <div style={{ padding: '10px', backgroundColor: '#d4edda', borderRadius: '4px', marginBottom: '16px', color: '#155724' }}>
                  Nuova quantità dopo carico: {selectedPresidio.quantita + movementQuantity} {selectedPresidio.unitaMisura || 'pezzi'}
                </div>
              )}
              <button
                type="button"
                onClick={eseguiMovimento}
                disabled={movementQuantity <= 0 || (movementType === 'scarico' && movementQuantity > selectedPresidio.quantita)}
                style={{ width: '100%', background: movementType === 'carico' ? '#28a745' : '#dc3545', padding: '12px', fontSize: '16px', opacity: movementQuantity <= 0 || (movementType === 'scarico' && movementQuantity > selectedPresidio.quantita) ? 0.6 : 1 }}
              >
                Conferma {movementType === 'carico' ? 'Carico' : 'Scarico'}
              </button>
            </div>
            <div>
              <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Storico Movimenti</h4>
              {movements.length === 0 ? (
                <p style={{ color: '#666', fontStyle: 'italic' }}>Nessun movimento registrato.</p>
              ) : (
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {movements.map((mov) => (
                    <div key={mov._id} style={{ display: 'flex', alignItems: 'center', padding: '10px', border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: '#f8f9fa', marginBottom: '8px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', backgroundColor: mov.tipo === 'carico' ? '#28a745' : '#dc3545', color: '#fff', fontSize: '12px', fontWeight: '600', marginRight: '12px' }}>
                        {mov.tipo === 'carico' ? '⬆' : '⬇'} {mov.tipo.toUpperCase()}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div>
                          <strong>{mov.quantita}</strong> {selectedPresidio.unitaMisura || 'pezzi'}
                          {mov.motivazione && <span style={{ color: '#666', marginLeft: '8px' }}>- {mov.motivazione}</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666' }}>
                          {formatDataOra(mov.dataMovimento)}
                          {mov.eseguitoDaNome && <span> - Da: {mov.eseguitoDaNome}</span>}
                          <span style={{ marginLeft: '8px' }}>{mov.quantitaPrecedente} → {mov.quantitaSuccessiva}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════════════════
          GESTIONE RICHIESTE OPERATORI (solo admin/coordinator)
      ══════════════════════════════════════════════════════════════════════ */}
      {(user?.role === 'admin' || user?.role === 'coordinator') && (
        <div style={{ marginTop: '32px' }}>
          <h3 style={{ color: '#1e4d8c', marginBottom: '16px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>
            📦 Gestione Richieste Presidi/Farmaci dagli Operatori
          </h3>
          <GestioneRichiestePresidi />
        </div>
      )}
    </section>
  );
}

export default Strumenti;
