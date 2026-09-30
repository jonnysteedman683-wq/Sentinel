import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-pre:p-4 prose-pre:rounded-xl relative">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({node, children, ...props}) => {
            return (
              <p {...props}>
                {children}
              </p>
            );
          }
        }}
      >
        {displayedText + (isTyping ? ' ▍' : '')}
      </ReactMarkdown>
    </div>
  );
};
