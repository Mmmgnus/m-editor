import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { FrontmatterPanel } from './frontmatter-panel';

export type EditorHandle = {
  insertTextAtCursor: (text: string) => void;
};

export const Editor = forwardRef<EditorHandle, { value: string; onChange: (v: string) => void }>(
  ({ value, onChange }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(ref, () => ({
      insertTextAtCursor: (text: string) => {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        const next = value.slice(0, start) + text + value.slice(end);
        onChange(next);
        // restore cursor just after inserted text
        requestAnimationFrame(() => {
          el.focus();
          const pos = start + text.length;
          el.setSelectionRange(pos, pos);
        });
      }
    }));

    return (
      <div>
        <FrontmatterPanel markdown={value} onChange={onChange} />
        <textarea
          ref={textareaRef}
          style={{
            width: '100%',
            height: 'calc(100vh - 40px - 60px)',
            border: 'none',
            outline: 'none',
            padding: 12,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
);
