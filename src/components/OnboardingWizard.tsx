import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Cloud, Shield, Settings, Check, ChevronRight } from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const nextStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const skip = () => onComplete();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        >
          <div className="p-8">
            <div className="flex justify-between items-center mb-8">
              <div className="flex space-x-2">
                {[...Array(totalSteps)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i + 1 === step ? 'w-8 bg-blue-500' : 'w-2 bg-gray-700'
                    }`}
                  />
                ))}
              </div>
              <button onClick={skip} className="text-gray-400 hover:text-white text-sm">
                Skip
              </button>
            </div>

            <div className="min-h-[300px]">
              {step === 1 && (
                <div className="text-center space-y-6">
                  <div className="w-24 h-24 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Brain size={48} />
                  </div>
                  <h2 className="text-3xl font-bold text-white tracking-tight">Welcome to Arcane Quantum Brain</h2>
                  <p className="text-gray-400 text-lg max-w-md mx-auto">
                    Your personal, federated cognitive engine. Experience intelligent debates, dream cycles, and advanced memory consolidation.
                  </p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center space-x-4 text-blue-400 mb-6">
                    <Cloud size={32} />
                    <h2 className="text-2xl font-bold text-white">Connect AI Backend</h2>
                  </div>
                  <p className="text-gray-400">
                    The system seamlessly integrates with the Gemini API to power the cognitive protocol.
                    All requests are securely proxied through the local server.
                  </p>
                  <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex items-start space-x-4">
                    <div className="mt-1"><Check size={20} className="text-green-500" /></div>
                    <div>
                      <h4 className="text-white font-medium">Server-Side Proxy Enabled</h4>
                      <p className="text-gray-400 text-sm">Your keys are never exposed to the client.</p>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="flex items-center space-x-4 text-purple-400 mb-6">
                    <Shield size={32} />
                    <h2 className="text-2xl font-bold text-white">Federated Learning & Privacy</h2>
                  </div>
                  <p className="text-gray-400">
                    Join the global cognitive weave while maintaining strict privacy.
                    Models are trained locally and only differential updates are shared.
                  </p>
                  <div className="space-y-3 mt-6">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input type="checkbox" defaultChecked className="form-checkbox h-5 w-5 text-purple-500 rounded border-gray-600 bg-gray-700" />
                      <span className="text-white font-medium">Opt-in to Federated Learning</span>
                    </label>
                    <p className="text-sm text-gray-500 ml-8">Help improve the global model securely.</p>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div className="flex items-center space-x-4 text-green-400 mb-6">
                    <Settings size={32} />
                    <h2 className="text-2xl font-bold text-white">System Calibration</h2>
                  </div>
                  <p className="text-gray-400">
                    The cognitive engine is now spinning up its internal states, initializing the Active Inference and HRL policies.
                  </p>
                  <div className="flex justify-center py-8">
                    <div className="animate-spin text-green-500">
                      <Settings size={48} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-8 pt-8 border-t border-gray-800">
              <button
                onClick={nextStep}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                <span>{step === totalSteps ? 'Launch System' : 'Continue'}</span>
                {step !== totalSteps && <ChevronRight size={20} />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
