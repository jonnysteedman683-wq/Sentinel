const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target1 = `          const aiDocRef = doc(chatsRef); // Generate ID locally
          const { isTyping, ...saveData } = aiMessageData;
          await setDoc(aiDocRef, saveData); // Don't save isTyping to firestore
          
          // Local update to trigger typewriter immediately for logged-in users too
          setMessages(prev => [...prev, { id: aiDocRef.id, ...aiMessageData }]);`;

const repl1 = `          const aiDocRef = doc(chatsRef); // Generate ID locally
          const { isTyping, ...saveData } = aiMessageData;
          
          // Local update to trigger typewriter immediately for logged-in users too
          setMessages(prev => {
            if (prev.some(m => m.id === aiDocRef.id)) return prev;
            return [...prev, { id: aiDocRef.id, ...aiMessageData }];
          });
          
          await setDoc(aiDocRef, saveData); // Don't save isTyping to firestore`;

code = code.replace(target1, repl1);

fs.writeFileSync('src/App.tsx', code);
