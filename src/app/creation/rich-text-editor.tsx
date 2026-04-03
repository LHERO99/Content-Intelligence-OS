'use client';

import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
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
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  content: string;
  onSave: (content: string) => void;
  isSaving?: boolean;
}

const MenuBar = ({ editor }: { editor: any }) => {
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
    </div>
  );
};

export function RichTextEditor({ content, onSave, isSaving }: RichTextEditorProps) {
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
        class: 'focus:outline-none p-8 min-h-[500px] prose prose-sm sm:prose-base lg:prose-lg max-w-none prose-headings:text-[#00463c] prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-slate-600 prose-a:text-emerald-600 prose-emerald',
      },
    },
  });

  return (
    <div className="rounded-md border bg-white flex flex-col overflow-hidden">
      <MenuBar editor={editor} />
      <div className="flex-1 overflow-auto max-h-[600px] custom-scrollbar">
        <EditorContent editor={editor} />
      </div>
      <div className="border-t p-3 bg-muted/10 flex justify-end">
        <Button 
          onClick={() => editor && onSave(editor.getHTML())} 
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
