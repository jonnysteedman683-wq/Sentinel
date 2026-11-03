import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownMessage } from '../src/components/MarkdownMessage';
import { TypewriterText } from '../src/components/TypewriterText';

describe('MarkdownMessage', () => {
  it('renders bold, lists and GFM tables', () => {
    const md = '**bold** text\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |';
    const { container } = render(<MarkdownMessage text={md} />);
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('table')).not.toBeNull();
  });

  it('opens links in a new tab safely', () => {
    render(<MarkdownMessage text="[docs](https://example.com)" />);
    const link = screen.getByRole('link', { name: 'docs' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('does not render raw HTML from message content', () => {
    const { container } = render(<MarkdownMessage text={'<img src=x onerror="alert(1)">'} />);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('TypewriterText', () => {
  it('renders markdown immediately when not typing', () => {
    const { container } = render(
      <TypewriterText text="# Title" isTyping={false} onComplete={vi.fn()} />,
    );
    expect(container.querySelector('h1')?.textContent).toBe('Title');
  });
});
