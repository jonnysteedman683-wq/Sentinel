import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Radio } from 'lucide-react';

interface VoiceBridgeProps {
  onSpeechRecognized: (text: string) => void;
  textToSpeak?: string | null;
}

export const VoiceBridge: React.FC<VoiceBridgeProps> = ({ onSpeechRecognized, textToSpeak }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<any>(null);

  // Constants for VAD
  const VAD_THRESHOLD = 0.015; // Noise threshold
  const INTERRUPT_THRESHOLD = 0.035; // Loudness to interrupt AI
  const SILENCE_TIMEOUT = 1400; // ms of silence before committing speech

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
        // Automatically restart if voice loop is active
        if (isListening) {
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
        if (isSpeaking && rms > INTERRUPT_THRESHOLD) {
          window.speechSynthesis?.cancel();
          setIsSpeaking(false);
        }

        // 2. VAD: Detect when user is speaking
        if (rms > VAD_THRESHOLD) {
          setIsUserSpeaking(true);
          // Clear previous silence timeout
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (isUserSpeaking) {
          // User was speaking but now is silent, set commit timer
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

        // Choose color based on voice status
        let strokeColor = 'rgba(100, 116, 139, 0.4)'; // Slate (Idle)
        if (isSpeaking) {
          strokeColor = '#2dd4bf'; // Teal (AI Speaking)
        } else if (isUserSpeaking) {
          strokeColor = '#ec4899'; // Pink/Rose (User speaking)
        } else if (isListening) {
          strokeColor = '#6366f1'; // Indigo (Listening)
        }
        ctx.strokeStyle = strokeColor;
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          // Scale waves based on speaker state for aesthetics
          let amplitude = 1.0;
          if (isSpeaking) {
            amplitude = Math.sin(Date.now() * 0.01 + i) * 0.8;
          } else if (isListening && !isUserSpeaking) {
            amplitude = 0.15; // Ambient breathing
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
        ctx.shadowBlur = 0; // reset
      };

      draw();
    } catch (err) {
      console.warn("Could not setup audio context / visualizer", err);
    }
  }, [cleanupAudio, isSpeaking, isUserSpeaking, isListening]);

  // Handle Voice Synthesis Speak
  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;

    window.speechSynthesis.cancel(); // Stop current speech

    // Clean up markdown syntax for speech
    const cleanText = text
      .replace(/<[^>]*>?/gm, '') // Remove HTML tags
      .replace(/[*_#`]/g, '') // Remove markdown formatting
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Replace links with just text

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Try to find a good premium English voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.rate = 1.1; // Slightly faster for responsiveness

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

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
    setVoiceEnabled(!voiceEnabled);
    if (voiceEnabled) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
  };

  useEffect(() => {
    return () => cleanupAudio();
  }, [cleanupAudio]);

  return (
    <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-50 animate-in fade-in slide-in-from-bottom-6 duration-500">
      {isListening && (
        <div className="bg-slate-950/90 backdrop-blur-xl border border-white/5 rounded-2xl p-3 flex flex-col items-center gap-1 shadow-2xl w-48 transition-all">
          <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest uppercase mb-1">
            <Radio className={`w-3.5 h-3.5 ${isUserSpeaking ? 'text-pink-400 animate-pulse' : isSpeaking ? 'text-teal-400 animate-pulse' : 'text-indigo-400'}`} />
            <span className={isUserSpeaking ? 'text-pink-400' : isSpeaking ? 'text-teal-400' : 'text-slate-400'}>
              {isUserSpeaking ? 'User Talking' : isSpeaking ? 'AI Output' : 'Listening...'}
            </span>
          </div>
          <canvas ref={canvasRef} width={160} height={40} className="w-full h-10 rounded-lg bg-black/40 border border-white/5" />
        </div>
      )}

      <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full p-2 shadow-2xl shadow-indigo-500/10 transition-all">
        <button 
          onClick={toggleVoice}
          className={`p-3 rounded-full transition-all ${voiceEnabled ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' : 'bg-slate-800 text-slate-400 hover:text-slate-200'} ${isSpeaking ? 'animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.5)]' : ''}`}
          title={voiceEnabled ? "Mute AI Voice" : "Enable AI Voice"}
        >
          {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>

        <div className="w-px h-6 bg-white/10 mx-1"></div>

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
