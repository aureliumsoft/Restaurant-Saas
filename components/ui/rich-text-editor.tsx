'use client';

import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Underline,
  Heading2,
  Link2,
  Undo2,
  Redo2,
  Type,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Props = {
  id?: string;
  label?: string;
  value: string;
  onChange: (html: string) => void;
  helperText?: string;
  className?: string;
};

const EMPTY_HTML = '<p><br></p>';

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'BLOCKQUOTE',
  'PRE',
]);

function normalizeEmpty(html: string): string {
  const t = html.replace(/\u200B/g, '').trim();
  if (
    !t ||
    t === '<br>' ||
    t === '<div><br></div>' ||
    t === '<p></p>' ||
    t === '<p><br></p>'
  ) {
    return EMPTY_HTML;
  }
  return html;
}

function isBlockElement(el: Element): boolean {
  return BLOCK_TAGS.has(el.tagName);
}

/** Nearest block-level ancestor inside the editor (not the editor root). */
function findBlockAncestor(
  node: Node | null,
  editor: HTMLElement
): HTMLElement | null {
  let cur: Node | null = node;
  while (cur && cur !== editor) {
    if (cur.nodeType === Node.ELEMENT_NODE) {
      const el = cur as HTMLElement;
      if (isBlockElement(el) && el.parentElement) {
        // Prefer outer block over LI when we want heading (skip li → use parent flow)
        if (el.tagName === 'LI') {
          // headings don't belong inside li well — format the li's content as h2 is rare;
          // treat the li as the block for list items
          return el;
        }
        return el;
      }
    }
    cur = cur.parentNode;
  }
  return null;
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/**
 * Replace the current block with tagName (e.g. h2 / p).
 * More reliable than document.execCommand('formatBlock') across browsers.
 */
function setBlockTag(editor: HTMLElement, tagName: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    placeCaretAtEnd(editor);
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  let block = findBlockAncestor(selection.anchorNode, editor);

  // Empty editor or caret only on root: ensure a paragraph first
  if (!block || block === editor) {
    if (!editor.innerHTML.trim() || editor.innerHTML === '<br>') {
      editor.innerHTML = EMPTY_HTML;
    }
    // Use selection / first child
    const first = editor.firstElementChild as HTMLElement | null;
    if (first && isBlockElement(first)) {
      block = first;
    } else {
      // Wrap loose text nodes
      const wrap = document.createElement('p');
      while (editor.firstChild) {
        wrap.appendChild(editor.firstChild);
      }
      if (!wrap.innerHTML) wrap.innerHTML = '<br>';
      editor.appendChild(wrap);
      block = wrap;
    }
  }

  if (!block || block === editor) return;

  // Don't convert list structure to heading mid-list in a broken way —
  // if inside LI, convert the LI content by wrapping not replacing UL
  if (block.tagName === 'LI') {
    // Extract list item to a heading block after the list when possible
    const heading = document.createElement(tagName);
    heading.innerHTML = block.innerHTML || '<br>';
    const list = block.parentElement;
    if (list && (list.tagName === 'UL' || list.tagName === 'OL')) {
      list.parentElement?.insertBefore(heading, list.nextSibling);
      block.remove();
      if (!list.children.length) list.remove();
    } else {
      block.replaceWith(heading);
    }
    placeCaretAtEnd(heading);
    return;
  }

  const upper = tagName.toUpperCase();
  // Toggle: if already this heading, convert back to paragraph
  if (block.tagName === upper) {
    tagName = 'p';
  }

  const next = document.createElement(tagName);
  next.innerHTML = block.innerHTML || '<br>';
  // Preserve common attrs if any
  block.replaceWith(next);
  placeCaretAtEnd(next);
}

export function RichTextEditor({
  id: idProp,
  label = 'Blog detail',
  value,
  onChange,
  helperText,
  className,
}: Props) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);
  const focusedRef = useRef(false);

  // Sync from parent only when not actively typing in this editor
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (focusedRef.current) return;
    const next = value?.trim() ? value : EMPTY_HTML;
    if (el.innerHTML !== next) {
      el.innerHTML = next;
    }
    lastEmitted.current = value;
  }, [value]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const html = normalizeEmpty(el.innerHTML);
    if (html === lastEmitted.current) return;
    lastEmitted.current = html;
    onChange(html);
  }, [onChange]);

  const ensureFocusAndSelection = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    const inside =
      sel.rangeCount > 0 && sel.anchorNode && el.contains(sel.anchorNode);
    if (!inside) {
      placeCaretAtEnd(el);
    }
  };

  const run = (cmd: string, arg?: string) => {
    ensureFocusAndSelection();
    try {
      document.execCommand(cmd, false, arg);
    } catch {
      // ignore unsupported command
    }
    emit();
  };

  const applyHeading = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    ensureFocusAndSelection();
    setBlockTag(el, 'h2');
    emit();
  };

  const applyParagraph = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    ensureFocusAndSelection();
    setBlockTag(el, 'p');
    emit();
  };

  const wrapLink = () => {
    ensureFocusAndSelection();
    const url = window.prompt('Link URL', 'https://');
    if (!url?.trim()) return;
    document.execCommand('createLink', false, url.trim());
    emit();
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label ? (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-input bg-background shadow-sm">
        <div
          className="flex flex-wrap gap-1 border-b border-border/80 bg-muted/40 p-2"
          data-unsaved-ignore
        >
          <ToolbarButton label="Bold" onClick={() => run('bold')}>
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Italic" onClick={() => run('italic')}>
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Underline" onClick={() => run('underline')}>
            <Underline className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Heading" onClick={applyHeading}>
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Normal text" onClick={applyParagraph}>
            <Type className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Bullet list"
            onClick={() => run('insertUnorderedList')}
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Numbered list"
            onClick={() => run('insertOrderedList')}
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Link" onClick={wrapLink}>
            <Link2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Undo" onClick={() => run('undo')}>
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Redo" onClick={() => run('redo')}>
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>
        </div>
        <div
          id={id}
          ref={ref}
          role="textbox"
          aria-multiline
          contentEditable
          suppressContentEditableWarning
          className={cn(
            'min-h-[220px] max-h-[480px] overflow-y-auto px-4 py-3 text-sm outline-none',
            // Tailwind preflight strips heading size — restore explicit styles
            '[&_h1]:my-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:text-foreground',
            '[&_h2]:my-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:text-foreground',
            '[&_h3]:my-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground',
            '[&_p]:my-2 [&_p]:leading-relaxed',
            '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6',
            '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6',
            '[&_li]:my-0.5',
            '[&_a]:text-primary [&_a]:underline'
          )}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={() => {
            focusedRef.current = false;
            emit();
          }}
          onInput={emit}
          onKeyUp={emit}
        />
      </div>
      {helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="h-8 w-8"
      title={label}
      aria-label={label}
      onMouseDown={(e) => {
        // Keep caret in the editor
        e.preventDefault();
        onClick();
      }}
    >
      {children}
    </Button>
  );
}
