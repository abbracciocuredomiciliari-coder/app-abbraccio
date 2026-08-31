import { useRef, useState, useCallback } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import api from '../api/api';

interface DictationMicButtonProps {
  onTranscribed: (testo: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * Pulsante microfono riutilizzabile per la dettatura vocale.
 * Registra audio dal microfono, lo invia a /relazioni-vocali/trascrivi
 * (Groq Whisper) e restituisce il testo trascritto al chiamante,
 * che lo inserisce nel proprio campo testuale.
 */
export function DictationMicButton({ onTranscribed, disabled, compact }: DictationMicButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startRecording = async () => {
    setError(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stopTimer();
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        await inviaAudio(blob);
      };
      recorder.onerror = () => { setError('Errore durante la registrazione'); stopTimer(); setIsRecording(false); };

      recorder.start(200);
      setIsRecording(true);
      startTimer();
    } catch (err: any) {
      let message = 'Impossibile avviare il microfono.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') message = 'Permesso microfono negato.';
      else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') message = 'Nessun microfono rilevato.';
      else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') message = 'Microfono occupato da un\'altra applicazione.';
      setError(message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const inviaAudio = async (blob: Blob) => {
    setIsProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      const res = await api.post('/relazioni-vocali/trascrivi', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000,
      });
      const testo = String(res.data?.trascrizione || '').trim();
      if (testo) onTranscribed(testo);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore nella trascrizione audio');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const baseBtnStyle: React.CSSProperties = {
    border: 'none', borderRadius: '6px', cursor: disabled || isProcessing ? 'not-allowed' : 'pointer',
    fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px',
    padding: compact ? '8px 10px' : '8px 14px', fontSize: '0.85rem',
    opacity: disabled || isProcessing ? 0.6 : 1,
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px' }}>
      {!isRecording ? (
        <button type="button" onClick={startRecording} disabled={disabled || isProcessing} style={{ ...baseBtnStyle, background: '#7c3aed', color: 'white' }} title="Detta con il microfono">
          {isProcessing ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Mic size={15} />}
          {!compact && (isProcessing ? 'Trascrizione...' : 'Detta')}
        </button>
      ) : (
        <button type="button" onClick={stopRecording} style={{ ...baseBtnStyle, background: '#dc2626', color: 'white' }} title="Ferma registrazione">
          <Square size={15} />
          {!compact && `Ferma (${formatTime(seconds)})`}
        </button>
      )}
      {error && <span style={{ fontSize: '0.72rem', color: '#dc2626', maxWidth: '220px' }}>{error}</span>}
    </div>
  );
}
