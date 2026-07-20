import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Radio, Headphones, Zap } from 'lucide-react';
import { ElevenLabsTTS, DEFAULT_VOICES } from '../lib/elevenlabs-tts.js';

interface VoiceBridgeProps {
  onSpeechRecognized: (text: string) => void;
  textToSpeak?: string | null;
}

export const VoiceBridge: React.FC<VoiceBridgeProps> = ({ onSpeechRecognized, textToSpeak }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    return localStorage.getItem('voice_enabled') === 'true';
  });
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [continuousMode, setContinuousMode] = useState(() => {
    return localStorage.getItem('voice_continuous') === 'true';
  });
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState(() => {
    return ElevenLabsTTS.loadVoicePreference();
  });
  const [usingElevenLabs, setUsingElevenLabs] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const ttsRef = useRef<ElevenLabsTTS | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const continuousModeRef = useRef(continuousMode);
  const voiceEnabledRef = useRef(voiceEnabled);
  const isSpeakingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { continuousModeRef.current = continuousMode; }, [continuousMode]);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  // Constants for VAD
  const VAD_THRESHOLD = 0.015;
  const INTERRUPT_THRESHOLD = 0.035;
  const SILENCE_TIMEOUT = 1400;

  // Initialize ElevenLabs TTS
  useEffect(() => {
    const apiKey = typeof process !== 'undefined' ? process.env.ELEVENLABS_API_KEY || '' : '';
    ttsRef.current = new ElevenLabsTTS(apiKey);
    setUsingElevenLabs(ttsRef.current.enabled);
    ttsRef.current.setVoice(selectedVoiceId);
  }, [selectedVoiceId]);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript.trim()) {
          onSpeechRecognized(finalTranscript);
        }
      };

      recognitionRef.current.onend = () => {
        // Auto-restart if voice loop is active (and not currently speaking)
        if (isListening && !isSpeakingRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            // Already started
          }
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
          setIsListening(false);
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      window.speechSynthesis?.cancel();
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current = null;
      }
    };
  }, [onSpeechRecognized, isListening]);

  // Clean up Web Audio setup
  const cleanupAudio = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
  }, []);

  // Web Audio VAD and Visualizer loop
  const setupAudioMonitor = useCallback(async () => {
    cleanupAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animationFrameRef.current = requestAnimationFrame(draw);
        if (!analyserRef.current || !canvasRef.current) return;

        analyserRef.current.getByteTimeDomainData(dataArray);

        // Calculate RMS (Volume)
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / bufferLength);

        // 1. Auto-Interrupt AI if speaking and user talks
        if (isSpeakingRef.current && rms > INTERRUPT_THRESHOLD) {
          window.speechSynthesis?.cancel();
          if (audioElRef.current) {
            audioElRef.current.pause();
            audioElRef.current = null;
          }
          setIsSpeaking(false);
        }

        // 2. VAD: Detect when user is speaking
        if (rms > VAD_THRESHOLD) {
          setIsUserSpeaking(true);
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (isUserSpeaking) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              setIsUserSpeaking(false);
              silenceTimerRef.current = null;
            }, SILENCE_TIMEOUT);
          }
        }

        // 3. Render dynamic waveform on Canvas
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 3;

        let strokeColor = 'rgba(100, 116, 139, 0.4)';
        if (isSpeakingRef.current) {
          strokeColor = usingElevenLabs ? '#a855f7' : '#2dd4bf'; // Purple for ElevenLabs, teal for browser
        } else if (isUserSpeaking) {
          strokeColor = '#ec4899';
        } else if (isListening) {
          strokeColor = '#6366f1';
        }
        ctx.strokeStyle = strokeColor;
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          let amplitude = 1.0;
          if (isSpeakingRef.current) {
            amplitude = Math.sin(Date.now() * 0.01 + i) * 0.8;
          } else if (isListening && !isUserSpeaking) {
            amplitude = 0.15;
          }
          
          const y = (v * canvas.height) / 2 + (amplitude * 15 * (v - 1.0));

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      };

      draw();
    } catch (err) {
      console.warn("Could not setup audio context / visualizer", err);
    }
  }, [cleanupAudio, isUserSpeaking, isListening, usingElevenLabs]);

  // Handle ElevenLabs TTS
  const speakWithElevenLabs = useCallback(async (text: string) => {
    if (!ttsRef.current?.enabled) return false;

    const audioUrl = await ttsRef.current.speak(text, selectedVoiceId);
    if (!audioUrl) return false;

    // Stop any existing audio
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }

    const audio = new Audio(audioUrl);
    audioElRef.current = audio;
    
    audio.onplay = () => setIsSpeaking(true);
    audio.onended = () => {
      setIsSpeaking(false);
      URL.revokeObjectURL(audioUrl);
      audioElRef.current = null;
      // In continuous mode, ensure listening is active after speaking ends
      if (continuousModeRef.current && isListening) {
        try { recognitionRef.current?.start(); } catch (e) {}
      }
    };
    audio.onerror = () => {
      setIsSpeaking(false);
      URL.revokeObjectURL(audioUrl);
      audioElRef.current = null;
    };

    await audio.play();
    return true;
  }, [selectedVoiceId, isListening]);

  // Handle Browser TTS (fallback)
  const speakWithBrowser = useCallback((text: string) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const cleanText = text
      .replace(/<[^>]*>?/gm, '')
      .replace(/[*_#`]/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

    const utterance = new SpeechSynthesisUtterance(cleanText);

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.rate = 1.1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // In continuous mode, ensure listening is active after speaking ends
      if (continuousModeRef.current && isListening) {
        try { recognitionRef.current?.start(); } catch (e) {}
      }
    };
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [isListening]);

  // Unified speak function — tries ElevenLabs first, falls back to browser
  const speak = useCallback(async (text: string) => {
    if (!voiceEnabledRef.current) return;

    // Try ElevenLabs first
    if (ttsRef.current?.enabled) {
      const success = await speakWithElevenLabs(text);
      if (success) return;
    }

    // Fall back to browser TTS
    speakWithBrowser(text);
  }, [speakWithElevenLabs, speakWithBrowser]);

  // Trigger speech when input updates
  useEffect(() => {
    if (textToSpeak && voiceEnabled) {
      speak(textToSpeak);
    }
  }, [textToSpeak, voiceEnabled, speak]);

  const toggleListening = async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      cleanupAudio();
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
        await setupAudioMonitor();
      } catch (e) {
        console.error("Could not start speech recognition", e);
      }
    }
  };

  const toggleVoice = () => {
    const newVal = !voiceEnabled;
    setVoiceEnabled(newVal);
    localStorage.setItem('voice_enabled', String(newVal));
    if (!newVal) {
      window.speechSynthesis?.cancel();
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current = null;
      }
      setIsSpeaking(false);
    }
  };

  const toggleContinuousMode = () => {
    const newVal = !continuousMode;
    setContinuousMode(newVal);
    localStorage.setItem('voice_continuous', String(newVal));
  };

  const selectVoice = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    if (ttsRef.current) {
      ttsRef.current.setVoice(voiceId);
    }
  };

  useEffect(() => {
    return () => cleanupAudio();
  }, [cleanupAudio]);

  return (
    <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-50 animate-in fade-in slide-in-from-bottom-6 duration-500">
      {/* Voice Picker Dropdown */}
      {showVoicePicker && (
        <div className="bg-slate-950/95 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-2xl w-56 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="text-[9px] font-bold tracking-widest uppercase text-slate-500 mb-2">
            {usingElevenLabs ? 'ElevenLabs Voices' : 'Browser TTS (no API key)'}
          </div>
          {usingElevenLabs ? (
            <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
              {DEFAULT_VOICES.map(voice => (
                <button
                  key={voice.id}
                  onClick={() => selectVoice(voice.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                    selectedVoiceId === voice.id
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="font-medium">{voice.name}</div>
                  {voice.description && (
                    <div className="text-[10px] text-slate-500 mt-0.5">{voice.description}</div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-slate-500 leading-relaxed py-2 px-1">
              Set <code className="text-indigo-400">ELEVENLABS_API_KEY</code> in your environment to enable premium voices.
            </div>
          )}
        </div>
      )}

      {/* Waveform Visualizer */}
      {isListening && (
        <div className="bg-slate-950/90 backdrop-blur-xl border border-white/5 rounded-2xl p-3 flex flex-col items-center gap-1 shadow-2xl w-48 transition-all">
          <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase mb-1">
            <Radio className={`w-3.5 h-3.5 ${isUserSpeaking ? 'text-pink-400 animate-pulse' : isSpeaking ? (usingElevenLabs ? 'text-purple-400 animate-pulse' : 'text-teal-400 animate-pulse') : 'text-indigo-400'}`} />
            <span className={isUserSpeaking ? 'text-pink-400' : isSpeaking ? (usingElevenLabs ? 'text-purple-400' : 'text-teal-400') : 'text-slate-400'}>
              {isUserSpeaking ? 'User Talking' : isSpeaking ? (usingElevenLabs ? 'AI (ElevenLabs)' : 'AI Output') : 'Listening...'}
            </span>
          </div>
          <canvas ref={canvasRef} width={160} height={40} className="w-full h-10 rounded-lg bg-black/40 border border-white/5" />
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full p-2 shadow-2xl shadow-indigo-500/10 transition-all">
        {/* TTS Enable/Disable */}
        <button 
          onClick={toggleVoice}
          className={`p-3 rounded-full transition-all ${voiceEnabled ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' : 'bg-slate-800 text-slate-400 hover:text-slate-200'} ${isSpeaking ? 'animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.5)]' : ''}`}
          title={voiceEnabled ? "Mute AI Voice" : "Enable AI Voice"}
        >
          {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>

        {/* Voice Picker Toggle */}
        <button 
          onClick={() => setShowVoicePicker(!showVoicePicker)}
          className={`p-3 rounded-full transition-all ${showVoicePicker ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'} ${usingElevenLabs ? 'shadow-[0_0_8px_rgba(168,85,247,0.3)]' : ''}`}
          title="Voice Settings"
        >
          <Headphones className="w-5 h-5" />
        </button>

        {/* Continuous Mode Toggle */}
        <button 
          onClick={toggleContinuousMode}
          className={`p-3 rounded-full transition-all ${continuousMode ? 'bg-amber-500/20 text-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]' : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}
          title={continuousMode ? "Continuous conversation ON (auto-listen after AI speaks)" : "Enable continuous conversation mode"}
        >
          <Zap className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-white/10 mx-1"></div>

        {/* Mic Toggle */}
        <button 
          onClick={toggleListening}
          className={`p-3 rounded-full transition-all ${isListening ? 'bg-rose-500/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.5)] animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}
          title={isListening ? "Stop Hands-Free Loop" : "Tap to Speak (Hands-Free)"}
        >
          {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};
