import type { ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

/**
 * Renders chat message text as GitHub-flavoured Markdown.
 * Raw HTML in the source is not rendered (react-markdown default), so model
 * output can't inject markup. Colours inherit from the parent bubble so it
 * follows the app's own light/dark theme rather than the OS setting.
 */
export function MarkdownMessage({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="chat-markdown prose prose-sm md:prose-base max-w-none break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
      {children}
    </div>
  );
}
