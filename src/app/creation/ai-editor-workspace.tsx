'use strict';

import React from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';

interface AIEditorWorkspaceProps {
  v1Content: string;
  v2Content: string;
  mode?: 'Erstellung' | 'Optimierung' | 'Planung';
}

export function AIEditorWorkspace({ v1Content, v2Content, mode = 'Optimierung' }: AIEditorWorkspaceProps) {
  if (mode === 'Erstellung') {
    return (
      <div className="rounded-md border bg-white overflow-hidden">
        <div className="border-b bg-emerald-50/50 p-2 text-sm font-bold text-[#00463c]">
          Neu erstellter Content
        </div>
        <div className="p-6 overflow-auto max-h-[600px] prose prose-emerald max-w-none">
          <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
            {v2Content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white overflow-hidden">
      <div className="grid grid-cols-2 border-b bg-muted/50 text-sm font-medium">
        <div className="p-2 border-r">v1 (Aktuell)</div>
        <div className="p-2">v2 (KI Vorschlag)</div>
      </div>
      <div className="overflow-auto max-h-[600px]">
        <ReactDiffViewer
          oldValue={v1Content}
          newValue={v2Content}
          splitView={true}
          useDarkTheme={false}
          styles={{
            variables: {
              light: {
                diffViewerBackground: '#fff',
                diffViewerColor: '#212529',
                addedBackground: '#e6ffed',
                addedColor: '#24292e',
                removedBackground: '#ffeef0',
                removedColor: '#24292e',
                wordAddedBackground: '#acf2bd',
                wordRemovedBackground: '#fdb8c0',
                addedGutterBackground: '#cdffd8',
                removedGutterBackground: '#ffdce0',
                gutterColor: '#959da5',
                codeFoldGutterBackground: '#f1f8ff',
                codeFoldBackground: '#f1f8ff',
                emptyLineBackground: '#fafbfc',
                gutterBackground: '#f6f8fa',
                highlightBackground: '#fffbdd',
                highlightGutterBackground: '#fff5b1',
              },
            },
            line: {
              padding: '4px 0',
              '&:hover': {
                background: '#f7f8f9',
              },
            },
          }}
        />
      </div>
    </div>
  );
}
