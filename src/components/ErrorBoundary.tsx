import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Terminal, ChevronRight, ChevronDown, Copy, Check, Activity } from 'lucide-react';
import { ingestTelemetry } from '../lib/api.js';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  isExpanded: boolean;
  telemetrySent: boolean;
  countdown?: number;
}

/**
 * React Error Boundary Component.
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors to backend telemetry, and displays a beautiful, highly interactive
 * diagnostic visual screen to ensure graceful degradation and professional developer visibility.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
    isExpanded: false,
    telemetrySent: false,
    countdown: undefined
  };

  private timer: any = null;

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Automatically capture and transmit this catastrophic failure to telemetry
    ingestTelemetry({
      type: 'REACT_FATAL_UI_ERROR',
      data: {
        message: error.message,
        name: error.name,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        userAgent: window.navigator.userAgent,
      }
    })
    .then(() => this.setState({ telemetrySent: true }))
    .catch((err) => console.error('Failed to dispatch fatal error telemetry:', err));

    // Start auto-routing countdown
    this.startCountdown();
  }

  private startCountdown = () => {
    this.setState({ countdown: 5 });
    this.timer = setInterval(() => {
      this.setState(prevState => {
        if (prevState.countdown !== undefined && prevState.countdown <= 1) {
          clearInterval(this.timer);
          this.handleReset();
          return { countdown: 0 };
        }
        return { countdown: prevState.countdown !== undefined ? prevState.countdown - 1 : undefined };
      });
    }, 1000);
  };

  public componentWillUnmount() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private handleReset = () => {
    if (this.timer) {
      clearInterval(this.timer);
    }
    // Attempt local state recovery or soft page refresh
    window.localStorage.removeItem('cognitive-session'); // clear potentially corrupt session state
    window.location.reload();
  };

  private copyToClipboard = () => {
    const diagnosticText = `
Error: ${this.state.error?.name || 'Error'}: ${this.state.error?.message}
Stack: ${this.state.error?.stack}
Component Stack: ${this.state.errorInfo?.componentStack}
Timestamp: ${new Date().toISOString()}
Url: ${window.location.href}
    `.trim();

    navigator.clipboard.writeText(diagnosticText)
      .then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      })
      .catch((err) => console.error('Could not copy diagnostics:', err));
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div id="cortex-error-boundary" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans antialiased selection:bg-purple-500/30">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.12),rgba(255,255,255,0))]" />
          
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800/80 rounded-2xl p-8 shadow-2xl backdrop-blur-md overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500 via-purple-600 to-red-500 animate-pulse" />
            
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-2xl text-red-400">
                <AlertOctagon size={40} className="animate-pulse" />
              </div>
              
              <div className="space-y-2">
                <span className="text-xs font-mono uppercase tracking-widest text-red-400 font-semibold px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full">
                  Cortex Crash Detected
                </span>
                <h1 className="text-3xl font-bold font-sans tracking-tight text-slate-100">
                  Cognitive Thread Aborted
                </h1>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  A fatal runtime error occurred within the application layer. The neural pipeline has degraded gracefully to isolate this exception.
                </p>
              </div>

              {this.state.error && (
                <div className="w-full bg-slate-950 border border-slate-800/60 rounded-xl p-4 text-left font-mono text-xs text-red-300 overflow-x-auto select-all max-h-40 scrollbar-thin">
                  <span className="text-red-400 font-bold block mb-1">
                    {this.state.error.name}:
                  </span>
                  {this.state.error.message}
                </div>
              )}

              {this.state.countdown !== undefined && (
                <div className="text-xs text-slate-500 font-mono animate-pulse pt-2">
                  Auto-routing to home screen in {this.state.countdown}s...
                </div>
              )}

              <div className="flex flex-wrap gap-3 items-center justify-center pt-2">
                <button
                  onClick={this.handleReset}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-purple-600/15 group"
                >
                  <RotateCcw size={16} className="group-hover:rotate-45 transition" />
                  Neural Resync
                </button>
                <button
                  onClick={this.copyToClipboard}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-750 active:bg-slate-900 text-slate-300 font-medium text-sm rounded-xl border border-slate-700/60 transition"
                >
                  {this.state.copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  {this.state.copied ? 'Diagnostics Copied' : 'Copy Diagnostics'}
                </button>
              </div>

              {/* Collapsible advanced trace */}
              <div className="w-full pt-4 border-t border-slate-800/80">
                <button
                  onClick={() => this.setState({ isExpanded: !this.state.isExpanded })}
                  className="w-full flex items-center justify-between text-slate-400 hover:text-slate-200 text-xs font-mono font-medium transition"
                >
                  <span className="flex items-center gap-2">
                    <Terminal size={14} className="text-slate-500" />
                    Advanced Diagnostic Stack Trace
                  </span>
                  {this.state.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {this.state.isExpanded && (
                  <div className="mt-3 text-left space-y-4">
                    <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 font-mono text-[10px] text-slate-400 overflow-x-auto max-h-64 scrollbar-thin space-y-2">
                      <div>
                        <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wider mb-0.5">Component Stack:</span>
                        <pre className="whitespace-pre-wrap text-slate-300">{this.state.errorInfo?.componentStack}</pre>
                      </div>
                      <div className="border-t border-slate-850/60 pt-2 mt-2">
                        <span className="text-slate-500 block uppercase font-bold text-[9px] tracking-wider mb-0.5">Runtime Stack Trace:</span>
                        <pre className="whitespace-pre-wrap text-red-400/80">{this.state.error?.stack}</pre>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Activity size={10} className="text-purple-500" />
                        Diagnostic state: {this.state.telemetrySent ? 'Telemetry transmitted successfully' : 'Telemetry pending...'}
                      </span>
                      <span>ENV: Production</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
