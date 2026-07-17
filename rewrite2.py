import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Update activeTab
code = code.replace(
    "const [activeTab, setActiveTab] = useState<SidebarTab>('Memory');",
    "const [activeTab, setActiveTab] = useState<SidebarTab>('Chat');"
)

code = code.replace(
    "type SidebarTab = 'Memory' | 'Brains' | 'Heartbeat' | 'Mind Map' | 'Brainstorm' | 'Logs' | 'Telemetry' | 'Neural Debugger' | 'Memoria' | 'Workspace';",
    "type SidebarTab = 'Chat' | 'Memory' | 'Brains' | 'Heartbeat' | 'Mind Map' | 'Brainstorm' | 'Logs' | 'Telemetry' | 'Neural Debugger' | 'Memoria' | 'Workspace';"
)

# 2. Extract the tabs content (from <aside> ... </aside>)
aside_pattern = r"(<aside\b[^>]*>.*?<div className=\"p-6 flex-1 overflow-y-auto\">\s*)(.*?)(?=\s*</aside>)"
aside_match = re.search(aside_pattern, code, re.DOTALL)
if not aside_match:
    print("Could not find aside")
    exit(1)

tabs_content = aside_match.group(2)
# Remove the trailing </div> from tabs_content if it's there, which was the closing of `<div className="p-6 flex-1 overflow-y-auto">`
tabs_content = re.sub(r'</div>\s*$', '', tabs_content)


# 3. Extract the Chat content (from <main> ... </main>)
main_pattern = r"(<main\b[^>]*>.*?{/\* Chat Stream & Orb Container \*/}\n\s*<div className=\"flex-1 overflow-hidden relative flex flex-col\">\s*)(.*?)(?=\s*</main>)"
main_match = re.search(main_pattern, code, re.DOTALL)
if not main_match:
    print("Could not find main")
    exit(1)

chat_content = main_match.group(2)
# Remove the trailing </div> from chat_content if it's there
chat_content = re.sub(r'</div>\s*$', '', chat_content)

new_aside = """        {/* Narrow Sidebar Navigation */}
        <nav className={`w-16 md:w-20 flex-shrink-0 transition-all duration-300 ease-in-out border-r ${theme === 'dark' ? 'border-white/5 bg-black/40' : 'border-black/5 bg-white/60'} backdrop-blur-md overflow-hidden flex flex-col items-center py-4 z-30`}>
           <div className="relative flex items-center justify-center w-10 h-10 mb-4 cursor-pointer" onClick={() => setSidebarOpen(!isSidebarOpen)}>
             <svg viewBox="0 0 24 24" className={`w-full h-full stroke-amber-400 ${theme === 'dark' ? 'fill-amber-950/50' : 'fill-amber-100/50'}`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
               <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
               <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
               <line x1="12" y1="22.08" x2="12" y2="12"></line>
             </svg>
             <span className="absolute text-[9px] font-bold text-amber-500 translate-y-[2px]">AQB</span>
           </div>

           <div className="flex flex-col gap-2 w-full px-2 mt-4">
             <button onClick={() => handleTabChange('Chat')} title="Neural Interface" className={`p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Chat' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <MessageSquare className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Memory')} title="Memory" className={`p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Memory' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Brain className={`w-5 h-5 ${isConsolidating ? 'animate-pulse text-teal-300' : ''}`} />
             </button>
             <button onClick={() => handleTabChange('Brains')} title="Brains" className={`p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Brains' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Cpu className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Heartbeat')} title="Heartbeat" className={`p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Heartbeat' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Activity className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Mind Map')} title="Mind Map" className={`p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Mind Map' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Network className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Brainstorm')} title="Brainstorm" className={`p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Brainstorm' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Lightbulb className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Logs')} title="Logs" className={`p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Logs' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Terminal className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Telemetry')} title="Telemetry" className={`p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Telemetry' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Database className="w-5 h-5" />
             </button>
             <button onClick={() => handleTabChange('Workspace')} title="Workspace" className={`p-3 w-full flex items-center justify-center rounded-xl transition-all ${activeTab === 'Workspace' ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Search className="w-5 h-5" />
             </button>
           </div>
           
           <div className="mt-auto flex flex-col gap-2 w-full px-2">
             <button onClick={() => setIsSettingsOpen(true)} title="Settings" className={`p-3 w-full flex items-center justify-center rounded-xl transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}`}>
               <Settings className="w-5 h-5" />
             </button>
           </div>
        </nav>"""

new_main = f"""        {{/* Main Content Area */}}
        <main className="flex-1 flex flex-col min-w-0 relative h-full">
          {{/* Top Bar */}}
          <header className={{`h-16 border-b ${{theme === 'dark' ? 'border-white/5 bg-black/20' : 'border-black/5 bg-white/40'}} backdrop-blur-sm flex items-center justify-between px-6 flex-shrink-0 z-20`}}>
            <div className="flex items-center gap-4">
              <button 
                onClick={{() => setSidebarOpen(!isSidebarOpen)}}
                className={{`p-2 transition-colors rounded-lg md:hidden ${{theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}}`}}
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="hidden md:flex relative items-center justify-center w-9 h-9 opacity-0"></div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-400">
                    {{activeTab === 'Chat' ? 'Neural Interface' : activeTab}}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={{`w-1.5 h-1.5 rounded-full ${{
                      modelState === 'Idle' ? 'bg-blue-500' :
                      modelState === 'Listening' ? 'bg-pink-500 animate-pulse' :
                      modelState === 'Reasoning' ? 'bg-teal-400 animate-bounce' : 'bg-green-500'
                    }}`}} />
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">
                      Status: {{modelState}}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {{activeTab === 'Chat' && (
                <button 
                  onClick={{clearChat}}
                  className={{`p-2 transition-colors rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold ${{
                    theme === 'dark' 
                      ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10' 
                      : 'text-slate-500 hover:text-red-600 hover:bg-red-500/10'
                  }}`}}
                  title="Clear Chat History"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Reset Brain</span>
                </button>
              )}}
            </div>
          </header>

          <div className="flex-1 overflow-hidden relative flex flex-col w-full h-full">
            {{activeTab === 'Chat' ? (
              <>
                <div className="flex-1 overflow-hidden relative flex flex-col">
{chat_content}
                </div>
              </>
            ) : (
              <div className="p-6 flex-1 overflow-y-auto w-full h-full custom-scrollbar">
{tabs_content}
              </div>
            )}}
          </div>
        </main>"""

# Replace aside block
code = code[:aside_match.start()] + new_aside + code[aside_match.end():]

# Now find the main block since we modified the code string.
main_match = re.search(main_pattern, code, re.DOTALL)
if main_match:
    # Need to replace the whole <main> element, so extend the match to include <main>
    # The pattern matches from <main> up to the end of main contents (not including </main> itself)
    # But wait, my previous code replaced the whole thing up to </main>
    # Let's match from <main to </main>
    main_full_pattern = r"<main\b[^>]*>.*?</main>"
    main_full_match = re.search(main_full_pattern, code, re.DOTALL)
    if main_full_match:
        code = code[:main_full_match.start()] + new_main + code[main_full_match.end():]
else:
    print("Could not find main after aside replacement")
    exit(1)

code = code.replace("Database } from 'lucide-react';", "Database, MessageSquare } from 'lucide-react';")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Refactored successfully 2")
