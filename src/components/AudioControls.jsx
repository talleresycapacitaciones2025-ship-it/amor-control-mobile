import React from 'react';

export function AudioControls({ isSpeaking, audioEnabled, isConfigured, onToggleAudio, onSpeak, onStop, text, className = "" }) {
  const handleSpeak = async () => { if (isSpeaking) { onStop?.(); } else { await onSpeak?.(text); } };
  return (<div className={`flex items-center gap-2 ${className}`}>
    <button onClick={onToggleAudio} className={`p-2 rounded-full transition ${audioEnabled ? 'bg-teal-100 text-teal-700 hover:bg-teal-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`} title={audioEnabled ? 'Silenciar' : 'Activar audio'}>{audioEnabled ? '🔊' : '🔇'}</button>
    {text && (<button onClick={handleSpeak} disabled={!audioEnabled} className={`p-2 rounded-full transition relative ${isSpeaking ? 'bg-rose-100 text-rose-600 animate-pulse' : audioEnabled ? 'bg-teal-50 text-teal-600 hover:bg-teal-100' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`} title={isSpeaking ? 'Detener' : isConfigured ? 'Escuchar' : 'Modo demo'}>{isSpeaking ? '⏹️' : isConfigured ? '🔈' : '🎭'}{!isConfigured && audioEnabled && (<span className="absolute -top-1 -right-1 h-2 w-2 bg-amber-400 rounded-full animate-ping" />)}</button>)}
    {isSpeaking && (<span className="text-xs text-teal-600 font-medium animate-pulse">Reproduciendo...</span>)}
    {!isConfigured && (<span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Demo</span>)}
  </div>);
}