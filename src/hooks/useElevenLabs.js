import { useState, useCallback, useRef, useEffect } from 'react';

const BASE_URL = 'https://api.elevenlabs.io/v1';

export function useElevenLabs() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID;
    if (apiKey && !apiKey.includes('placeholder') && voiceId) {
      setIsConfigured(true);
      console.log('✅ ElevenLabs configurado');
    } else {
      console.log('🎭 Modo demo activo');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src?.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src);
        audioRef.current = null;
      }
    };
  }, []);

  const textToSpeech = useCallback(async (text) => {
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID;
    const modelId = import.meta.env.VITE_ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
    if (!apiKey || apiKey.includes('placeholder') || !voiceId) return null;
    if (!text?.trim()) throw new Error('Texto vacío');
    const safeText = text.length > 2500 ? text.slice(0, 2500) : text;
    try {
      setError(null);
      const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey, 'Accept': 'audio/mpeg' },
        body: JSON.stringify({ text: safeText, model_id: modelId, voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 0.9, style: 0.0, use_speaker_boost: true } })
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return await res.blob();
    } catch (err) { setError(err.message); return null; }
  }, []);

  const playAudio = useCallback(async (blob, autoPlay = true) => {
    if (!blob || (!audioEnabled && !autoPlay)) return null;
    try {
      if (audioRef.current) { audioRef.current.pause(); if (audioRef.current.src?.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src); }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setIsSpeaking(true);
      audio.onended = () => { setIsSpeaking(false); if (url.startsWith('blob:')) URL.revokeObjectURL(url); };
      audio.onerror = () => setIsSpeaking(false);
      if (autoPlay) await audio.play();
      return audio;
    } catch { setIsSpeaking(false); return null; }
  }, [audioEnabled]);

  const speak = useCallback(async (text, autoPlay = true) => {
    if (!audioEnabled && !autoPlay) return null;
    const blob = await textToSpeech(text);
    if (blob && autoPlay) await playAudio(blob, true);
    return blob;
  }, [textToSpeech, playAudio, audioEnabled]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); if (audioRef.current.src?.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src); audioRef.current = null; }
    setIsSpeaking(false);
  }, []);

  const toggleAudio = useCallback(() => { setAudioEnabled(p => !p); if (audioRef.current) audioRef.current.pause(); setIsSpeaking(false); }, []);

  return { isSpeaking, error, audioEnabled, isConfigured, speak, stopSpeaking, toggleAudio };
}