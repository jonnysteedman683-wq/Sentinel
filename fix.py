with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

old_str = """          <div className="flex-1 overflow-hidden relative flex flex-col w-full h-full">
            {activeTab === 'Chat' ? (
              <div className="flex-1 overflow-hidden relative flex flex-col w-full h-full">
"""
new_str = """          <div className="flex-1 overflow-hidden relative flex flex-col w-full h-full">
            {activeTab === 'Chat' ? (
              <>
              <div className="flex-1 overflow-hidden relative flex flex-col w-full h-full">
"""

code = code.replace(old_str, new_str)

old_str2 = """            ) : (
              <div className="p-6 flex-1 overflow-y-auto w-full h-full custom-scrollbar">"""
new_str2 = """              </>
            ) : (
              <div className="p-6 flex-1 overflow-y-auto w-full h-full custom-scrollbar">"""

code = code.replace(old_str2, new_str2)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print("Fixed")
