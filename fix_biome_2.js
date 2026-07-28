import { readFileSync, writeFileSync } from 'fs';

// App.tsx role="button" should be <button> instead of <div role="button">
let appContent = readFileSync('src/App.tsx', 'utf-8');

appContent = appContent.replace(
  '<div\n              role="button"\n              tabIndex={0}\n              onKeyDown={(e) => {\n                if (e.key === \'Enter\') setSidebarOpen(!isSidebarOpen);\n              }}\n              className="relative flex items-center justify-center w-10 h-10 cursor-pointer md:mb-4 hidden md:flex"\n              onClick={() => setSidebarOpen(!isSidebarOpen)}\n            >',
  '<button\n              type="button"\n              className="relative flex items-center justify-center w-10 h-10 cursor-pointer md:mb-4 hidden md:flex"\n              onClick={() => setSidebarOpen(!isSidebarOpen)}\n            >'
);
appContent = appContent.replace(
  '              <span className="absolute text-[9px] font-bold text-amber-500 translate-y-[2px]">\n                AQB\n              </span>\n            </div>',
  '              <span className="absolute text-[9px] font-bold text-amber-500 translate-y-[2px]">\n                AQB\n              </span>\n            </button>'
);
writeFileSync('src/App.tsx', appContent);

// ChatTab.tsx div with onContextMenu shouldn't have role="presentation", maybe role="group" or role="none" or just no role but aria-hidden? Actually just delete onContextMenu entirely? Wait, the context menu is a feature.
// Let's change the div to a div role="group"
let chatContent = readFileSync('src/components/tabs/ChatTab.tsx', 'utf-8');
chatContent = chatContent.replace('role="presentation"', 'role="group"');

writeFileSync('src/components/tabs/ChatTab.tsx', chatContent);
