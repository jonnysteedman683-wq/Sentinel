import React, { useState, useEffect, useRef } from 'react';
import { Eye, Mic, Video, MonitorUp, Shield, Activity, Radio, Fingerprint, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useVisionWorker } from './hooks/useVisionWorker';
import { recordEpisode } from './memory';
import { getGeminiClient } from './geminiClient';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
  'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
  'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear',
  'hair drier', 'toothbrush'
];

export function OverwatchPanel() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connectionLogs, setConnectionLogs] = useState<string[]>([]);
  const [cognitiveLogs, setCognitiveLogs] = useState<{ time: string, text: string, type: 'info'|'match'|'trigger' }[]>([]);
  const [detections, setDetections] = useState<any[]>([]);
  const [realityAnchor, setRealityAnchor] = useState<{ text: string; time: number } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastMemoryRef = useRef<{ desc: string, time: number }>({ desc: '', time: 0 });
  const aiClientRef = useRef<any>(null);

  useEffect(() => {
    aiClientRef.current = getGeminiClient();
  }, []);

  const triggerRealityAnchor = async (sceneDesc: string) => {
    if (!videoRef.current || !canvasRef.current || !aiClientRef.current || isScanning) return;
    setIsScanning(true);
    
    try {
      // Capture frame
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

      const prompt = `Analyze this live camera feed frame. YOLO detected these objects: ${sceneDesc}. Act as a tactical AI Overwatch system. Provide a brief "Reality Anchor" assessment of this scene:
1. Identify the likely context/activity.
2. Note any potential security risks, facts, or tactical observations.
Keep it strictly under 3 sentences. Be analytical and precise.`;

      const response = await aiClientRef.current.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
             role: 'user',
             parts: [
                { text: prompt },
                { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
             ]
          }
        ]
      });
      
      const text = response.text || '';
      setRealityAnchor({ text, time: Date.now() });
      setTimeout(() => setRealityAnchor(null), 15000);
      
      const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
      setCognitiveLogs(prev => [...prev.slice(-10), { time: timeStr, text: text, type: 'trigger' }]);
      
    } catch (err) {
      console.error("Failed to generate Reality Anchor:", err);
    } finally {
      setIsScanning(false);
    }
  };
  
  // Hook up the vision worker
  useVisionWorker(
    connectionState === 'connected' ? videoRef : { current: null },
    (dets) => {
      setDetections(dets);
      if (dets.length > 0) {
        // Record to episodic memory 
        const classNames = Array.from(new Set(dets.map((d: any) => {
          const idx = typeof d.class === 'number' ? Math.floor(d.class) : parseInt(d.class);
          return COCO_CLASSES[idx] || `class_${idx}`;
        }))).sort();
        
        const sceneDesc = classNames.join(', ');
        const now = Date.now();
        
        if (sceneDesc !== lastMemoryRef.current.desc || now - lastMemoryRef.current.time > 15000) {
          lastMemoryRef.current = { desc: sceneDesc, time: now };
          const maxConf = Math.max(...dets.map((d: any) => d.confidence));
          const content = `Visual Observation: Detected ${sceneDesc} with max confidence ${(maxConf * 100).toFixed(1)}%`;
          
          recordEpisode('observation', content, ['vision', 'overwatch']).catch(err => {
            console.error("Failed to record vision memory:", err);
          });
          
          // Trigger Reality Anchor assessment
          if (dets.length > 0) {
            triggerRealityAnchor(sceneDesc);
          }
        }

        setConnectionLogs(prev => {
          const newLogs = [...prev, `[VISION] Object detected (Class ${dets[0].class}) - Conf: ${(dets[0].confidence * 100).toFixed(1)}%`];
          return newLogs.slice(-20); // keep last 20
        });
      }
    }
  );

  // Draw detections
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.clientWidth || 640;
    canvas.height = videoRef.current.clientHeight || 480;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (detections.length === 0) return;

    const scaleX = canvas.width / (videoRef.current.videoWidth || 640);
    const scaleY = canvas.height / (videoRef.current.videoHeight || 480);

    detections.forEach(det => {
      const [x1, y1, x2, y2] = det.bbox;
      const w = x2 - x1;
      const h = y2 - y1;

      ctx.strokeStyle = '#06b6d4'; // cyan-500
      ctx.lineWidth = 2;
      ctx.strokeRect(x1 * scaleX, y1 * scaleY, w * scaleX, h * scaleY);

      ctx.fillStyle = '#06b6d4';
      ctx.font = '12px monospace';
      ctx.fillText(`Class ${det.class} (${(det.confidence * 100).toFixed(0)}%)`, x1 * scaleX, (y1 * scaleY) > 15 ? (y1 * scaleY) - 5 : 15);
    });
  }, [detections, connectionState]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (connectionState === 'connecting') {
      setConnectionLogs(['[WEBRTC] Initializing peer connection...', '[WEBRTC] Gathering ICE candidates...']);
      
      // Simulate WebRTC connection sequence
      timeoutId = setTimeout(() => {
        setConnectionLogs(prev => [...prev, '[WEBRTC] ICE candidates gathered.', '[WEBRTC] Negotiating SDP...']);
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          .then(s => {
            setStream(s);
            if (videoRef.current) {
              videoRef.current.srcObject = s;
            }
            setConnectionLogs(prev => [...prev, '[WEBRTC] Media stream acquired.', '[WEBRTC] Connection established.']);
            setTimeout(() => {
              setConnectionState('connected');
            }, 500);
          })
          .catch(e => {
            console.error("Media access denied:", e);
            setConnectionLogs(prev => [...prev, `[WEBRTC] ERROR: Media access denied (${e.name}).`, '[WEBRTC] Connection failed.']);
            setTimeout(() => {
              setConnectionState('disconnected');
            }, 2000);
          });
      }, 1500);
    } else if (connectionState === 'disconnected') {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      setConnectionLogs([]);
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [connectionState]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const toggleConnection = () => {
    if (connectionState === 'disconnected') {
      setConnectionState('connecting');
    } else {
      setConnectionState('disconnected');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/5 via-slate-950 to-slate-950 pointer-events-none z-0"></div>
      
      <div className="p-4 md:p-6 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur flex justify-between items-center z-10 shadow-sm relative">
        <div className="flex items-center gap-3 text-cyan-400 font-bold tracking-[0.2em] uppercase">
          <div className="p-1.5 bg-cyan-500/10 rounded-lg border border-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
            <Eye size={18} />
          </div>
          <span className="font-display text-lg">Overwatch Mode</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleConnection}
            disabled={connectionState === 'connecting'}
            className={`px-6 py-2 rounded-lg font-bold tracking-widest text-xs flex items-center gap-2 transition-all disabled:opacity-50 ${
              connectionState === 'connected' 
                ? 'bg-rose-950/80 text-rose-400 border border-rose-900/80 shadow-[0_0_20px_rgba(244,63,94,0.3)]' 
                : connectionState === 'connecting'
                  ? 'bg-amber-950/80 text-amber-400 border border-amber-900/80'
                  : 'bg-cyan-950/80 text-cyan-400 border border-cyan-900/80 hover:bg-cyan-900/80 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
            }`}
          >
            {connectionState === 'connected' ? (
              <><span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> TERMINATE UPLINK</>
            ) : connectionState === 'connecting' ? (
              <><RefreshCcw size={14} className="animate-spin" /> CONNECTING...</>
            ) : (
              <><Radio size={14} /> INITIALIZE UPLINK</>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden shadow-inner aspect-video relative flex items-center justify-center"
            >
              <AnimatePresence mode="wait">
                {connectionState === 'connected' ? (
                  <motion.div 
                    key="active"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black"
                  >
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover opacity-80 mix-blend-screen grayscale contrast-125"
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 w-full h-full pointer-events-none z-20"
                    />
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>
                    <div className="absolute inset-0 border-[4px] border-cyan-500/20 pointer-events-none"></div>
                    
                    {/* HUD Elements */}
                    <div className="absolute top-4 left-4 flex gap-2">
                      <div className="bg-black/50 backdrop-blur border border-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded text-[10px] font-bold tracking-widest font-mono flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                        LIVE FEED
                      </div>
                      <div className="bg-black/50 backdrop-blur border border-slate-700/50 text-slate-300 px-3 py-1.5 rounded text-[10px] font-bold tracking-widest font-mono">
                        1080p / 60FPS
                      </div>
                    </div>
                    
                    {/* Reality Anchor HUD */}
                    <AnimatePresence>
                      {realityAnchor && (Date.now() - realityAnchor.time < 15000) && (
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute top-16 left-4 max-w-[280px] bg-black/60 backdrop-blur-md border border-cyan-500/40 rounded-lg p-3 shadow-lg shadow-cyan-900/20 pointer-events-none"
                        >
                          <div className="text-[10px] text-cyan-400 font-mono tracking-widest mb-1 flex items-center gap-2 uppercase">
                            <Activity size={12} /> Reality Anchor
                          </div>
                          <div className="text-xs text-slate-200 leading-relaxed font-mono">
                            {realityAnchor.text}
                          </div>
                        </motion.div>
                      )}
                      
                      {isScanning && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute top-16 left-4 max-w-[280px] bg-black/60 backdrop-blur-md border border-amber-500/40 rounded-lg p-3 shadow-lg pointer-events-none flex items-center gap-3"
                        >
                          <RefreshCcw size={14} className="animate-spin text-amber-400" />
                          <div className="text-[10px] text-amber-400 font-mono tracking-widest uppercase">
                            Assessing Context...
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                      <div className="flex flex-col gap-1">
                        <div className="text-cyan-400/80 text-[10px] font-mono tracking-widest">COORDINATES</div>
                        <div className="text-slate-200 text-xs font-mono">LAT 37.7749 // LNG -122.4194</div>
                      </div>
                      
                      {/* Audio visualizer mockup */}
                      <div className="flex items-end gap-1 h-8">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div 
                            key={i} 
                            className="w-1.5 bg-cyan-400/70 rounded-t-sm"
                            style={{ 
                              height: `${20 + Math.random() * 80}%`,
                              animation: `pulse ${0.5 + Math.random() * 0.5}s infinite alternate` 
                            }}
                          ></div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Crosshair */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center opacity-30 pointer-events-none">
                      <div className="w-16 h-16 border border-cyan-400 rounded-full"></div>
                      <div className="absolute w-2 h-2 bg-cyan-400 rounded-full"></div>
                      <div className="absolute w-full h-[1px] bg-cyan-400"></div>
                      <div className="absolute h-full w-[1px] bg-cyan-400"></div>
                    </div>
                  </motion.div>
                ) : connectionState === 'connecting' ? (
                  <motion.div 
                    key="connecting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col w-full h-full p-8"
                  >
                    <div className="text-xs font-bold text-amber-500 tracking-widest uppercase mb-4 flex items-center gap-2">
                      <RefreshCcw size={16} className="animate-spin" /> Establishing WebRTC Handshake
                    </div>
                    <div className="flex-1 bg-slate-950/80 rounded-xl p-4 font-mono text-xs overflow-y-auto space-y-2 border border-slate-800 shadow-inner">
                      {connectionLogs.map((log, i) => (
                         <div key={i} className="text-slate-400">{log}</div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="inactive"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center text-slate-600 gap-4"
                  >
                    <Eye size={48} className="opacity-20" />
                    <div className="text-xs font-bold tracking-[0.3em]">SENSOR ARRAY OFFLINE</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="grid grid-cols-3 gap-4">
              <div className={`bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors ${connectionState === 'connected' ? 'text-cyan-400 border-cyan-900/50 shadow-[0_0_15px_rgba(34,211,238,0.05)]' : 'text-slate-500'}`}>
                <Mic size={24} />
                <span className="text-[10px] font-bold tracking-widest uppercase">Audio Stream</span>
              </div>
              <div className={`bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors ${connectionState === 'connected' ? 'text-cyan-400 border-cyan-900/50 shadow-[0_0_15px_rgba(34,211,238,0.05)]' : 'text-slate-500'}`}>
                <Video size={24} />
                <span className="text-[10px] font-bold tracking-widest uppercase">Vision Feed</span>
              </div>
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-not-allowed text-slate-600">
                <MonitorUp size={24} />
                <span className="text-[10px] font-bold tracking-widest uppercase">Screen Share</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-inner h-[400px] flex flex-col"
            >
              <h3 className="text-xs font-bold text-cyan-400 mb-4 tracking-widest flex items-center gap-2 uppercase border-b border-slate-800/50 pb-3">
                <Activity size={14} /> Cognitive Analysis
              </h3>
              
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 font-mono">
                {connectionState === 'connected' ? (
                  <>
                    {cognitiveLogs.length === 0 ? (
                      <div className="text-xs text-slate-500 italic mt-4 text-center">Awaiting cognitive triggers...</div>
                    ) : (
                      cognitiveLogs.map((log, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`text-xs text-slate-300 bg-slate-950/50 p-3 rounded-lg border ${log.type === 'trigger' ? 'border-cyan-500/50' : 'border-slate-800/50'}`}
                        >
                          <span className={`${log.type === 'trigger' ? 'text-cyan-400' : 'text-slate-500'} font-bold mr-2`}>[{log.time}]</span> 
                          {log.text}
                        </motion.div>
                      ))
                    )}
                  </>
                ) : connectionState === 'connecting' ? (
                  <div className="h-full flex items-center justify-center text-amber-600/50 text-xs font-bold tracking-widest text-center animate-pulse">
                    INITIALIZING ANALYSIS ENGINE...
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-600 text-xs font-bold tracking-widest text-center">
                    AWAITING UPLINK TO BEGIN ANALYSIS
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-inner"
            >
              <h3 className="text-xs font-bold text-slate-400 mb-4 tracking-widest flex items-center gap-2 uppercase border-b border-slate-800/50 pb-3">
                <Shield size={14} /> WebRTC Datachannel
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Overwatch Mode utilizes WebRTC data channels for low-latency, peer-to-peer transmission. The cognitive engine runs locally where possible. Cloud telemetry is end-to-end encrypted. No raw audio or video is stored persistently without explicit directive.
              </p>
            </motion.div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
