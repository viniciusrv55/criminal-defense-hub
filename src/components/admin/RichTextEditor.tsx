import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, UnderlineIcon, Strikethrough, List, ListOrdered, Quote, Undo2, Redo2, Heading1, Heading2, Heading3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useImperativeHandle, forwardRef } from 'react';

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

export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(({ value, onChange, placeholder, minHeight = 360 }, ref) => {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: placeholder ?? 'Digite o conteúdo do modelo...' })],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none p-4',
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

  const Btn = ({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) => (
    <button type="button" title={title} onClick={onClick}
      className={`p-1.5 rounded transition-colors ${active ? 'bg-accent text-accent-foreground' : 'text-foreground/70 hover:bg-muted'}`}>
      {children}
    </button>
  );

  return (
    <div className="border border-input rounded-md bg-background">
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-border">
        <Btn title="Negrito" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></Btn>
        <Btn title="Itálico" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></Btn>
        <Btn title="Sublinhado" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleStrike().run()}><UnderlineIcon className="w-4 h-4" /></Btn>
        <Btn title="Tachado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="w-4 h-4" /></Btn>
        <span className="w-px h-5 bg-border mx-1" />
        <Btn title="Título 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="w-4 h-4" /></Btn>
        <Btn title="Título 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-4 h-4" /></Btn>
        <Btn title="Título 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="w-4 h-4" /></Btn>
        <span className="w-px h-5 bg-border mx-1" />
        <Btn title="Lista" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></Btn>
        <Btn title="Numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></Btn>
        <Btn title="Citação" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="w-4 h-4" /></Btn>
        <span className="w-px h-5 bg-border mx-1" />
        <Btn title="Desfazer" onClick={() => editor.chain().focus().undo().run()}><Undo2 className="w-4 h-4" /></Btn>
        <Btn title="Refazer" onClick={() => editor.chain().focus().redo().run()}><Redo2 className="w-4 h-4" /></Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
});
RichTextEditor.displayName = 'RichTextEditor';
