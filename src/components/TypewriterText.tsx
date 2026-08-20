import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

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
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-lg prose-a:text-teal-400 hover:prose-a:text-teal-300" style={{ color: 'inherit' }}>
      <ReactMarkdown
        components={{
          code: ({node, inline, className, children, ...props}: any) => {
            const match = /language-(\w+)/.exec(className || '')
            return !inline && match ? (
              <code className={`${className} bg-black/20 rounded px-1 py-0.5`} {...props}>
                {children}
              </code>
            ) : (
              <code className="bg-black/20 rounded px-1 py-0.5" {...props}>
                {children}
              </code>
            )
          }
        }}
      >
        {displayedText + (isTyping ? ' ▋' : '')}
      </ReactMarkdown>
    </div>
  );
};
