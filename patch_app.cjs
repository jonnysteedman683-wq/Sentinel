const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `{msg.systemUI ? (
                      <div className="w-full max-w-2xl">
                        {msg.systemUI === 'help' && (
                          <HelpWidget`;

const replacement = `<div className="flex flex-col gap-2 w-full max-w-full">
                      {msg.content && msg.content !== "{}" && msg.content !== '""' && (
                        <div className={\`max-w-[80%] p-5 rounded-2xl transition-all duration-300 \${
                          msg.role === 'user' 
                            ? 'bg-gradient-to-br from-indigo-600/80 to-indigo-900/80 border border-indigo-500/30 text-white shadow-lg shadow-indigo-900/20 backdrop-blur-md rounded-tr-sm self-end'
                            : theme === 'dark' 
                              ? 'bg-white/5 border border-white/10 text-slate-200 backdrop-blur-md shadow-xl rounded-tl-sm self-start'
                              : 'bg-white border border-black/5 text-slate-800 shadow-lg rounded-tl-sm self-start'
                        }\`}>
                          {msg.role === 'ai' ? (
                            <div className="flex flex-col gap-5 w-full">
                              <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0 mt-1">
                                  <Cpu className="w-4 h-4 text-teal-400" />
                                </div>
                                <div className={\`leading-relaxed \${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}\`}>
                                  <TypewriterText 
                                    text={typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) || ''}
                                    isTyping={!!msg.isTyping}
                                    onComplete={() => {
                                      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isTyping: false } : m))
                                    }}
                                  />
                                </div>
                              </div>
                              {msg.cognitiveLog && (
                                <div className="mt-4 border-t border-white/5 pt-4">
                                  <details className="group/cog">
                                    <summary className="flex items-center gap-2 cursor-pointer text-[10px] uppercase tracking-widest text-slate-500 hover:text-indigo-400 transition-colors list-none">
                                      <div className="p-1 rounded-md bg-white/5 group-hover/cog:bg-indigo-500/20 transition-colors">
                                        <Zap className="w-3 h-3" />
                                      </div>
                                      <span>Cognitive Process Trace</span>
                                    </summary>
                                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                      <div className={\`p-3 rounded-lg border \${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-black/5 border-black/5'}\`}>
                                        <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">1. Draft</span>
                                        <p className={\`text-xs italic line-clamp-3 \${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}\`}>{typeof msg.cognitiveLog.draft === 'string' ? msg.cognitiveLog.draft : JSON.stringify(msg.cognitiveLog.draft)}</p>
                                      </div>
                                      <div className={\`p-3 rounded-lg border \${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-black/5 border-black/5'}\`}>
                                        <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">2. Recollection</span>
                                        <p className={\`text-xs italic line-clamp-3 \${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}\`}>{typeof msg.cognitiveLog.recollection === 'string' ? msg.cognitiveLog.recollection : JSON.stringify(msg.cognitiveLog.recollection)}</p>
                                      </div>
                                      <div className={\`p-3 rounded-lg border \${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-black/5 border-black/5'}\`}>
                                        <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">3. Reflection</span>
                                        <p className={\`text-xs italic line-clamp-3 \${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}\`}>{typeof msg.cognitiveLog.reflection === 'string' ? msg.cognitiveLog.reflection : JSON.stringify(msg.cognitiveLog.reflection)}</p>
                                      </div>
                                      <div className={\`p-3 rounded-lg border \${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-black/5 border-black/5'}\`}>
                                        <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">4. Synthesis</span>
                                        <p className={\`text-xs italic line-clamp-3 \${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}\`}>{typeof msg.cognitiveLog.reiteration === 'string' ? msg.cognitiveLog.reiteration : JSON.stringify(msg.cognitiveLog.reiteration)}</p>
                                      </div>
                                    </div>
                                  </details>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}</p>
                          )}
                        </div>
                      )}
                      
                      {msg.systemUI ? (
                      <div className={\`w-full max-w-2xl \${msg.role === 'user' ? 'self-end' : 'self-start'} mt-2\`}>
                        {msg.systemUI === 'help' && (
                          <HelpWidget`;

code = code.replace(target, replacement);

const removeTarget = `                      </div>
                    ) : (
                      <div className={\`max-w-[80%] p-5 rounded-2xl transition-all duration-300 \${
                        msg.role === 'user' 
                          ? 'bg-gradient-to-br from-indigo-600/80 to-indigo-900/80 border border-indigo-500/30 text-white shadow-lg shadow-indigo-900/20 backdrop-blur-md rounded-tr-sm'
                          : theme === 'dark' 
                            ? 'bg-white/5 border border-white/10 text-slate-200 backdrop-blur-md shadow-xl rounded-tl-sm'
                            : 'bg-white border border-black/5 text-slate-800 shadow-lg rounded-tl-sm'
                      }\`}>
                      {msg.role === 'ai' ? (
                        <div className="flex flex-col gap-5 w-full">
                          <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0 mt-1">
                              <Cpu className="w-4 h-4 text-teal-400" />
                            </div>
                            <div className={\`leading-relaxed \${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}\`}>
                              <TypewriterText 
                                 text={typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) || ''}
                                 isTyping={!!msg.isTyping}
                                 onComplete={() => {
                                  setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isTyping: false } : m))
                                }}
                              />
                            </div>
                          </div>
                          {msg.cognitiveLog && (
                            <div className="mt-4 border-t border-white/5 pt-4">
                              <details className="group/cog">
                                <summary className="flex items-center gap-2 cursor-pointer text-[10px] uppercase tracking-widest text-slate-500 hover:text-indigo-400 transition-colors list-none">
                                  <div className="p-1 rounded-md bg-white/5 group-hover/cog:bg-indigo-500/20 transition-colors">
                                    <Zap className="w-3 h-3" />
                                  </div>
                                  <span>Cognitive Process Trace</span>
                                </summary>
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                  <div className={\`p-3 rounded-lg border \${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-black/5 border-black/5'}\`}>
                                    <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">1. Draft</span>
                                    <p className={\`text-xs italic line-clamp-3 \${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}\`}>{typeof msg.cognitiveLog.draft === 'string' ? msg.cognitiveLog.draft : JSON.stringify(msg.cognitiveLog.draft)}</p>
                                  </div>
                                  <div className={\`p-3 rounded-lg border \${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-black/5 border-black/5'}\`}>
                                    <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">2. Recollection</span>
                                    <p className={\`text-xs italic line-clamp-3 \${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}\`}>{typeof msg.cognitiveLog.recollection === 'string' ? msg.cognitiveLog.recollection : JSON.stringify(msg.cognitiveLog.recollection)}</p>
                                  </div>
                                  <div className={\`p-3 rounded-lg border \${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-black/5 border-black/5'}\`}>
                                    <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">3. Reflection</span>
                                    <p className={\`text-xs italic line-clamp-3 \${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}\`}>{typeof msg.cognitiveLog.reflection === 'string' ? msg.cognitiveLog.reflection : JSON.stringify(msg.cognitiveLog.reflection)}</p>
                                  </div>
                                  <div className={\`p-3 rounded-lg border \${theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-black/5 border-black/5'}\`}>
                                    <span className="text-[9px] uppercase tracking-wider text-slate-500 block mb-1">4. Synthesis</span>
                                    <p className={\`text-xs italic line-clamp-3 \${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}\`}>{typeof msg.cognitiveLog.reiteration === 'string' ? msg.cognitiveLog.reiteration : JSON.stringify(msg.cognitiveLog.reiteration)}</p>
                                  </div>
                                </div>
                              </details>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}</p>
                      )}
                      </div>
                    )}`;

code = code.replace(removeTarget, `                      </div>
                    ) : null}
                    </div>`);

fs.writeFileSync('src/App.tsx', code);
