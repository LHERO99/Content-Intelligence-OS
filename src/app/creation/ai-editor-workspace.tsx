'use strict';

import React from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';

interface AIEditorWorkspaceProps {
  v1Content: string;
  v2Content: string;
}

export function AIEditorWorkspace({ v1Content, v2Content }: AIEditorWorkspaceProps) {
  return (
    <div className="rounded-md border bg-white overflow-hidden">
      <div className="grid grid-cols-2 border-b bg-muted/50 text-sm font-medium">
        <div className="p-2 border-r">v1 (Current)</div>
        <div className="p-2">v2 (AI Proposed)</div>
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
