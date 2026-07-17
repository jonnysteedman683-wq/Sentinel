import React, { useState, useEffect, useRef } from 'react';

export const TypewriterText: React.FC<{ text?: string; isTyping: boolean; onComplete: () => void }> = ({ text = '', isTyping, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  useEffect(() => {
    const safeText = text || '';
    if (!isTyping) {
      setDisplayedText(safeText);
      return;
    }
    
    let index = 0;
    setDisplayedText('');
    const interval = setInterval(() => {
      const chunkSize = safeText.length > 200 ? 3 : 1;
      index += chunkSize;
      setDisplayedText(safeText.substring(0, index));
      if (index >= safeText.length) {
        clearInterval(interval);
        onCompleteRef.current();
      }
    }, 15);
    
    return () => clearInterval(interval);
  }, [text, isTyping]);
  
  return (
    <span>
      {displayedText}
      {isTyping && <span className="inline-block w-2 h-4 ml-1 bg-teal-400 animate-pulse align-middle" />}
    </span>
  );
};
