import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

interface VoiceBridgeProps {
  onSpeechRecognized: (text: string) => void;
  textToSpeak?: string | null;
}

export const VoiceBridge: React.FC<VoiceBridgeProps> = ({ onSpeechRecognized, textToSpeak }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
          onSpeechRecognized(transcript);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      window.speechSynthesis.cancel();
    };
  }, [onSpeechRecognized]);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    
    window.speechSynthesis.cancel(); // Stop current speech
    
    // Clean up markdown syntax for speech
    const cleanText = text
      .replace(/<[^>]*>?/gm, '') // Remove HTML tags
      .replace(/[*_#`]/g, '') // Remove markdown formatting
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Replace links with just text

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Try to find a good English voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.rate = 1.1; // Slightly faster for AI feel
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  useEffect(() => {
    if (textToSpeak && voiceEnabled) {
      speak(textToSpeak);
    }
  }, [textToSpeak, voiceEnabled, speak]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error("Could not start listening", e);
      }
    }
  };

  const toggleVoice = () => {
    setVoiceEnabled(!voiceEnabled);
    if (voiceEnabled) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-full p-2 shadow-2xl shadow-indigo-500/10 z-50">
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
        title={isListening ? "Stop Listening" : "Tap to Speak"}
      >
        {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </button>
    </div>
  );
};
