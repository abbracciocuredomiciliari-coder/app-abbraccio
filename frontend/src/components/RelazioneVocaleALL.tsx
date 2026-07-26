import { useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import api from '../api/api';

export function RelazioneVocaleALL({ contesto, onRelazione, onError }: { contesto: string; onRelazione: (relazione: string) => void; onError: (message: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = async () => {
    onError(''); chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        setRecording(false); streamRef.current?.getTracks().forEach(track => track.stop()); setProcessing(true);
        try {
          const form = new FormData();
          form.append('audio', new Blob(chunksRef.current, { type: mimeType || 'audio/webm' }), 'relazione.webm');
          form.append('contesto', contesto);
          const res = await api.post('/relazioni-vocali/professionale', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 });
          onRelazione(res.data.relazione || '');
        } catch (error: any) { onError(error.response?.data?.message || 'Errore nella trascrizione della relazione.'); }
        finally { setProcessing(false); }
      };
      recorder.start(300); setRecording(true);
    } catch { onError('Impossibile accedere al microfono. Verifica i permessi del browser.'); }
  };

  const stop = () => { if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop(); };
  return <button type="button" onClick={recording ? stop : start} disabled={processing} style={{ margin: '8px 0', padding: '9px 12px', cursor: processing ? 'wait' : 'pointer', border: '1px solid #0f766e', borderRadius: '6px', background: recording ? '#fef2f2' : '#f0fdfa', color: recording ? '#b91c1c' : '#0f766e', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>{processing ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> ALL elabora la relazione...</> : recording ? <><Square size={16} /> Ferma e crea relazione</> : <><Mic size={16} /> ALL - Dettatura relazione</>}</button>;
}
