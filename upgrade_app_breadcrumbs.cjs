const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const oldContentArea = `      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative bg-slate-950 font-sans">
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="h-full w-full absolute inset-0"
          >`;

const newContentArea = `      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-950 font-sans">
        
        {/* Breadcrumb Navigation Bar */}
        <div className="px-6 py-4 border-b border-slate-800/50 bg-slate-900/40 flex items-center gap-2 text-xs font-bold tracking-widest text-slate-500 z-30 shadow-sm shrink-0">
          <span className="text-slate-400">
            {tabGroups.find(g => g.tabs.some(t => t.id === activeTab))?.name || 'CORE'}
          </span>
          <ChevronRight size={14} className="opacity-50" />
          <span className={breadcrumbs.length > 0 ? "text-slate-400" : "text-emerald-400"}>
            {tabGroups.flatMap(g => g.tabs).find(t => t.id === activeTab)?.label || 'NEXUS'}
          </span>
          
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              <ChevronRight size={14} className="opacity-50" />
              <button 
                onClick={b.onClick} 
                className={\`transition-colors \${b.onClick ? 'hover:text-emerald-300' : 'cursor-default'} \${i === breadcrumbs.length - 1 ? 'text-emerald-400' : 'text-slate-400'}\`}
                disabled={!b.onClick}
              >
                {b.label}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 relative">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="h-full w-full absolute inset-0"
            >`;

content = content.replace(oldContentArea, newContentArea);

// We also need to close the extra div wrapper for the main content area
const oldClosing = `          </motion.div>
        </AnimatePresence>
      </div>
    </div>`;

const newClosing = `          </motion.div>
        </AnimatePresence>
        </div>
      </div>
    </div>`;

content = content.replace(oldClosing, newClosing);

fs.writeFileSync('src/App.tsx', content);
