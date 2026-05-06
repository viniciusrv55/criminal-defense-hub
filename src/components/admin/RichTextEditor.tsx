import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import {
  Bold, Italic, UnderlineIcon, Strikethrough, List, ListOrdered, Quote,
  Undo2, Redo2, Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Table as TableIcon, Link2, Image as ImageIcon, Minus, Pilcrow,
  RemoveFormatting, Indent, Outdent,
} from 'lucide-react';
import { Mark, mergeAttributes } from '@tiptap/core';
import { useEffect, useImperativeHandle, forwardRef } from 'react';

// FontSize mark (TipTap doesn't ship one by default)
const FontSize = Mark.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: el => (el as HTMLElement).style.fontSize?.replace(/['"]/g, '') || null,
        renderHTML: attrs => attrs.size ? { style: `font-size: ${attrs.size}` } : {},
      },
    };
  },
  parseHTML() { return [{ style: 'font-size' }]; },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes(HTMLAttributes), 0]; },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: any) => chain().setMark('fontSize', { size }).run(),
      unsetFontSize: () => ({ chain }: any) => chain().unsetMark('fontSize').run(),
    } as any;
  },
});

export interface RichTextEditorHandle {
  insertText: (text: string) => void;
  getHTML: () => string;
  setHTML: (html: string) => void;
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const FONT_SIZES = ['10px', '11px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px'];
const FONT_FAMILIES = ['Arial', 'Calibri', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana', 'Tahoma'];

export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(({ value, onChange, placeholder, minHeight = 480 }, ref) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      Placeholder.configure({ placeholder: placeholder ?? 'Digite o conteúdo do modelo...' }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      TextStyle,
      Color,
      FontFamily.configure({ types: ['textStyle'] }),
      FontSize,
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-accent underline' } }),
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'tiptap-doc prose prose-sm max-w-none focus:outline-none px-12 py-10 bg-white text-black',
        style: `min-height:${minHeight}px`,
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => { editor?.chain().focus().insertContent(text).run(); },
    getHTML: () => editor?.getHTML() ?? '',
    setHTML: (html: string) => { editor?.commands.setContent(html); },
  }), [editor]);

  if (!editor) return null;

  return (
    <div className="border border-input rounded-md bg-background overflow-hidden">
      <Toolbar editor={editor} />
      <div className="bg-muted/30 p-4 overflow-auto" style={{ maxHeight: '70vh' }}>
        <div className="mx-auto shadow-md" style={{ width: '210mm', minHeight: '297mm', background: 'white' }}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
});
RichTextEditor.displayName = 'RichTextEditor';

function Toolbar({ editor }: { editor: Editor }) {
  const Btn = ({ active, onClick, children, title, disabled }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string; disabled?: boolean }) => (
    <button type="button" title={title} disabled={disabled} onClick={onClick}
      className={`p-1.5 rounded transition-colors ${active ? 'bg-accent text-accent-foreground' : 'text-foreground/70 hover:bg-muted'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      {children}
    </button>
  );
  const Sep = () => <span className="w-px h-5 bg-border mx-0.5" />;

  const currentFont = (editor.getAttributes('textStyle').fontFamily as string) || '';
  const currentSize = (editor.getAttributes('fontSize').size as string) || '';
  const currentColor = (editor.getAttributes('textStyle').color as string) || '#000000';

  const insertLink = () => {
    const url = window.prompt('URL do link:');
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };
  const insertImage = () => {
    const url = window.prompt('URL da imagem (https://...):');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };
  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-border bg-card sticky top-0 z-10">
      {/* Font family */}
      <select
        title="Fonte"
        value={currentFont}
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setFontFamily(v).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
        className="h-8 text-xs px-2 rounded border border-input bg-background min-w-[110px]"
      >
        <option value="">Fonte</option>
        {FONT_FAMILIES.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
      </select>
      {/* Font size */}
      <select
        title="Tamanho"
        value={currentSize}
        onChange={(e) => {
          const v = e.target.value;
          if (v) (editor.chain().focus() as any).setFontSize(v).run();
          else (editor.chain().focus() as any).unsetFontSize().run();
        }}
        className="h-8 text-xs px-2 rounded border border-input bg-background w-[70px]"
      >
        <option value="">Tam.</option>
        {FONT_SIZES.map(s => <option key={s} value={s}>{parseInt(s)}</option>)}
      </select>
      {/* Color */}
      <label title="Cor do texto" className="flex items-center gap-1 px-1 cursor-pointer">
        <span className="text-xs text-foreground/70">A</span>
        <input type="color" value={currentColor} onChange={e => editor.chain().focus().setColor(e.target.value).run()} className="w-5 h-5 border-0 bg-transparent cursor-pointer" />
      </label>
      <Sep />

      {/* Inline marks */}
      <Btn title="Negrito (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></Btn>
      <Btn title="Itálico (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></Btn>
      <Btn title="Sublinhado (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="w-4 h-4" /></Btn>
      <Btn title="Tachado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="w-4 h-4" /></Btn>
      <Btn title="Limpar formatação" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="w-4 h-4" /></Btn>
      <Sep />

      {/* Headings */}
      <Btn title="Parágrafo" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}><Pilcrow className="w-4 h-4" /></Btn>
      <Btn title="Título 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="w-4 h-4" /></Btn>
      <Btn title="Título 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-4 h-4" /></Btn>
      <Btn title="Título 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="w-4 h-4" /></Btn>
      <Sep />

      {/* Alignment */}
      <Btn title="Alinhar à esquerda" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="w-4 h-4" /></Btn>
      <Btn title="Centralizar" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="w-4 h-4" /></Btn>
      <Btn title="Alinhar à direita" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="w-4 h-4" /></Btn>
      <Btn title="Justificar" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="w-4 h-4" /></Btn>
      <Sep />

      {/* Lists */}
      <Btn title="Lista" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></Btn>
      <Btn title="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></Btn>
      <Btn title="Citação" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="w-4 h-4" /></Btn>
      <Btn title="Diminuir recuo" onClick={() => editor.chain().focus().liftListItem('listItem').run()}><Outdent className="w-4 h-4" /></Btn>
      <Btn title="Aumentar recuo" onClick={() => editor.chain().focus().sinkListItem('listItem').run()}><Indent className="w-4 h-4" /></Btn>
      <Sep />

      {/* Insert */}
      <Btn title="Inserir tabela" onClick={insertTable}><TableIcon className="w-4 h-4" /></Btn>
      <Btn title="Inserir link" active={editor.isActive('link')} onClick={insertLink}><Link2 className="w-4 h-4" /></Btn>
      <Btn title="Inserir imagem" onClick={insertImage}><ImageIcon className="w-4 h-4" /></Btn>
      <Btn title="Linha horizontal" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="w-4 h-4" /></Btn>
      <Sep />

      {/* History */}
      <Btn title="Desfazer (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()}><Undo2 className="w-4 h-4" /></Btn>
      <Btn title="Refazer (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()}><Redo2 className="w-4 h-4" /></Btn>

      {/* Table contextual actions */}
      {editor.isActive('table') && (
        <>
          <Sep />
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className="text-[10px] px-1.5 py-1 rounded hover:bg-muted">+Col</button>
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className="text-[10px] px-1.5 py-1 rounded hover:bg-muted">+Lin</button>
          <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className="text-[10px] px-1.5 py-1 rounded hover:bg-muted">-Col</button>
          <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className="text-[10px] px-1.5 py-1 rounded hover:bg-muted">-Lin</button>
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className="text-[10px] px-1.5 py-1 rounded hover:bg-muted text-destructive">Excluir tab.</button>
        </>
      )}
    </div>
  );
}
