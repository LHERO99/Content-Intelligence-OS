'use client';

import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { html as beautifyHtml } from 'js-beautify';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2, 
  Heading3, 
  Link as LinkIcon, 
  Undo, 
  Redo,
  Save,
  Code,
  Type,
  Pilcrow
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  content: string;
  onSave: (content: string) => void;
  isSaving?: boolean;
}

const MenuBar = ({ editor, showCode, setShowCode }: { editor: any, showCode: boolean, setShowCode: (show: boolean) => void }) => {
  if (!editor) {
    return null;
  }

  const setLink = (e: React.MouseEvent) => {
    e.preventDefault();
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    action();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-slate-50/80 sticky top-0 z-20">
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => handleAction(e, () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
        className={cn('h-8 w-8 p-0 transition-all', editor.isActive('heading', { level: 1 }) ? 'bg-emerald-100 text-emerald-700 font-bold border border-emerald-200' : 'text-slate-500 hover:bg-slate-200')}
      >
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => handleAction(e, () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        className={cn('h-8 w-8 p-0 transition-all', editor.isActive('heading', { level: 2 }) ? 'bg-emerald-100 text-emerald-700 font-bold border border-emerald-200' : 'text-slate-500 hover:bg-slate-200')}
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => handleAction(e, () => editor.chain().focus().toggleHeading({ level: 3 }).run())}
        className={cn('h-8 w-8 p-0 transition-all', editor.isActive('heading', { level: 3 }) ? 'bg-emerald-100 text-emerald-700 font-bold border border-emerald-200' : 'text-slate-500 hover:bg-slate-200')}
      >
        <Heading3 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => handleAction(e, () => editor.chain().focus().setParagraph().run())}
        className={cn('h-8 w-8 p-0 transition-all', editor.isActive('paragraph') ? 'bg-emerald-100 text-emerald-700 font-bold border border-emerald-200' : 'text-slate-500 hover:bg-slate-200')}
        title="In Text umwandeln"
      >
        <Pilcrow className="h-4 w-4" />
      </Button>
      <div className="w-[1px] h-4 bg-slate-300 mx-1" />
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => handleAction(e, () => editor.chain().focus().toggleBold().run())}
        className={cn('h-8 w-8 p-0 transition-all', editor.isActive('bold') ? 'bg-emerald-100 text-emerald-700 font-bold border border-emerald-200' : 'text-slate-500 hover:bg-slate-200')}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => handleAction(e, () => editor.chain().focus().toggleItalic().run())}
        className={cn('h-8 w-8 p-0 transition-all', editor.isActive('italic') ? 'bg-emerald-100 text-emerald-700 font-bold border border-emerald-200' : 'text-slate-500 hover:bg-slate-200')}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={setLink}
        className={cn('h-8 w-8 p-0 transition-all', editor.isActive('link') ? 'bg-emerald-100 text-emerald-700 font-bold border border-emerald-200' : 'text-slate-500 hover:bg-slate-200')}
      >
        <LinkIcon className="h-4 w-4" />
      </Button>
      <div className="w-[1px] h-4 bg-slate-300 mx-1" />
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => handleAction(e, () => editor.chain().focus().toggleBulletList().run())}
        className={cn('h-8 w-8 p-0 transition-all', editor.isActive('bulletList') ? 'bg-emerald-100 text-emerald-700 font-bold border border-emerald-200' : 'text-slate-500 hover:bg-slate-200')}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => handleAction(e, () => editor.chain().focus().toggleOrderedList().run())}
        className={cn('h-8 w-8 p-0 transition-all', editor.isActive('orderedList') ? 'bg-emerald-100 text-emerald-700 font-bold border border-emerald-200' : 'text-slate-500 hover:bg-slate-200')}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <div className="w-[1px] h-4 bg-slate-300 mx-1" />
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => handleAction(e, () => editor.chain().focus().undo().run())}
        disabled={!editor.can().undo()}
        className="h-8 w-8 p-0 text-slate-500"
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => handleAction(e, () => editor.chain().focus().redo().run())}
        disabled={!editor.can().redo()}
        className="h-8 w-8 p-0 text-slate-500"
      >
        <Redo className="h-4 w-4" />
      </Button>
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={(e) => { e.preventDefault(); setShowCode(!showCode); }}
        className={cn('h-8 gap-2 px-3 transition-all', showCode ? 'bg-[#00463c] text-white' : 'text-slate-500 hover:bg-slate-200')}
      >
        {showCode ? <Type className="h-4 w-4" /> : <Code className="h-4 w-4" />}
        <span className="text-xs font-bold">{showCode ? 'Editor' : 'Code'}</span>
      </Button>
    </div>
  );
};

export function RichTextEditor({ content, onSave, isSaving }: RichTextEditorProps) {
  const [showCode, setShowCode] = React.useState(false);
  const [codeContent, setCodeContent] = React.useState(content);
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-emerald-600 underline cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder: 'Content hier bearbeiten...',
      }),
    ],
    content: content,
    editorProps: {
      attributes: {
        class: 'focus:outline-none p-8 min-h-[500px] prose prose-sm sm:prose-base lg:prose-lg max-w-none prose-headings:text-[#00463c] prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-slate-600 prose-a:text-emerald-600 prose-emerald font-poppins',
      },
    },
  });

  // When switching to Code mode, format the current editor content
  React.useEffect(() => {
    if (editor && showCode) {
      const html = editor.getHTML();
      const formatted = beautifyHtml(html, {
        indent_size: 2,
        wrap_line_length: 80,
        preserve_newlines: true,
        unformatted: ['code', 'pre', 'em', 'strong', 'span']
      });
      setCodeContent(formatted);
    }
  }, [showCode, editor]);

  // When switching back to Editor mode, update Tiptap content
  React.useEffect(() => {
    if (editor && !showCode) {
      const currentEditorHtml = editor.getHTML();
      if (currentEditorHtml !== codeContent) {
        editor.commands.setContent(codeContent, { emitUpdate: false });
      }
    }
  }, [showCode, editor]);

  return (
    <div className="rounded-md border bg-white flex flex-col overflow-hidden h-full">
      <MenuBar editor={editor} showCode={showCode} setShowCode={setShowCode} />
      <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
        {showCode ? (
          <textarea
            value={codeContent}
            onChange={(e) => setCodeContent(e.target.value)}
            className="w-full h-full p-8 font-mono text-sm bg-slate-950 text-emerald-400 focus:outline-none resize-none"
            spellCheck={false}
          />
        ) : (
          <div className="editor-container h-full">
            <style jsx global>{`
              @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');

              .ProseMirror {
                padding: 0.75rem 2rem !important;
                min-height: 100%;
                outline: none;
                font-family: 'Poppins', sans-serif !important;
              }
              .ProseMirror h1 {
                font-size: 2.25rem !important;
                line-height: 1.2 !important;
                font-weight: 800 !important;
                margin-top: 0 !important;
                margin-bottom: 0.5rem !important;
                color: #00463c !important;
                display: block !important;
              }
              .ProseMirror h2 {
                font-size: 1.875rem !important;
                line-height: 1.2 !important;
                font-weight: 700 !important;
                margin-top: 1.25rem !important;
                margin-bottom: 0.5rem !important;
                color: #00463c !important;
                display: block !important;
              }
              .ProseMirror h3 {
                font-size: 1.5rem !important;
                line-height: 1.2 !important;
                font-weight: 600 !important;
                margin-top: 1.25rem !important;
                margin-bottom: 0.5rem !important;
                color: #00463c !important;
                display: block !important;
              }
              .ProseMirror p {
                margin-top: 0.5rem !important;
                margin-bottom: 0.5rem !important;
                line-height: 1.2 !important;
                color: #334155 !important;
                display: block !important;
              }
              .ProseMirror ul, .ProseMirror ol {
                margin-top: 0.5rem !important;
                margin-bottom: 0.5rem !important;
                padding-left: 1.5rem !important;
                list-style-type: disc !important;
                display: block !important;
              }
              .ProseMirror ol {
                list-style-type: decimal !important;
              }
              .ProseMirror li {
                margin-top: 0.25rem !important;
                margin-bottom: 0.25rem !important;
                line-height: 1.2 !important;
                display: list-item !important;
              }
            `}</style>
            <EditorContent editor={editor} className="h-full" />
          </div>
        )}
      </div>
      <div className="border-t p-3 bg-muted/10 flex justify-end">
        <Button 
          onClick={() => {
            if (showCode) {
              onSave(codeContent);
            } else if (editor) {
              onSave(editor.getHTML());
            }
          }} 
          disabled={isSaving}
          className="bg-[#00463c] hover:bg-[#00332c] text-white gap-2 h-9"
        >
          {isSaving ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Speichern
        </Button>
      </div>
    </div>
  );
}
