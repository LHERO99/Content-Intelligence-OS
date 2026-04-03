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

  const setLink = () => {
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

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/20">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={cn('h-8 w-8 p-0', editor.isActive('heading', { level: 1 }) && 'bg-muted')}
      >
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={cn('h-8 w-8 p-0', editor.isActive('heading', { level: 2 }) && 'bg-muted')}
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={cn('h-8 w-8 p-0', editor.isActive('heading', { level: 3 }) && 'bg-muted')}
      >
        <Heading3 className="h-4 w-4" />
      </Button>
      <div className="w-[1px] h-4 bg-border mx-1" />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn('h-8 w-8 p-0', editor.isActive('bold') && 'bg-muted')}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn('h-8 w-8 p-0', editor.isActive('italic') && 'bg-muted')}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={setLink}
        className={cn('h-8 w-8 p-0', editor.isActive('link') && 'bg-muted')}
      >
        <LinkIcon className="h-4 w-4" />
      </Button>
      <div className="w-[1px] h-4 bg-border mx-1" />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={cn('h-8 w-8 p-0', editor.isActive('bulletList') && 'bg-muted')}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={cn('h-8 w-8 p-0', editor.isActive('orderedList') && 'bg-muted')}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <div className="w-[1px] h-4 bg-border mx-1" />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
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
        class: 'focus:outline-none p-6 min-h-[400px] prose prose-emerald max-w-none prose-sm sm:prose-base',
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
