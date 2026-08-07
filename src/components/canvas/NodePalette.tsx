'use client';

import React from 'react';
import { Bot, FileText, Terminal, Globe, Search } from 'lucide-react';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';

export function NodePalette() {
  const addNode = useCanvasStore((s: any) => s.addNode);

  // Drag handler for dragging nodes onto canvas
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  // Click handler to instantly spawn node on canvas
  const handleAddNode = (type: string) => {
    const newNode = {
      id: `node_${type}_${Date.now()}`,
      type,
      position: {
        x: 300 + Math.floor(Math.random() * 60),
        y: 150 + Math.floor(Math.random() * 60),
      },
      data: {
        label:
          type === 'agent'
            ? 'Agent Node'
            : type === 'input'
              ? 'User Input'
              : type === 'api'
                ? 'API Fetcher'
                : type === 'rag'
                  ? 'RAG Filter'
                  : 'Final Output',
      },
    };
    addNode(newNode);
  };

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950 p-4 text-slate-100 flex flex-col gap-3 font-sans select-none z-10">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
        Node Library
      </div>

      {/* Agent Node */}
      <div
        onClick={() => handleAddNode('agent')}
        onDragStart={(e) => onDragStart(e, 'agent')}
        draggable
        className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-blue-500/50 transition-all cursor-pointer active:scale-95"
      >
        <Bot className="w-5 h-5 text-blue-400 shrink-0" />
        <div>
          <div className="text-xs font-medium">Agent Node</div>
          <div className="text-[10px] text-slate-400">LLM worker for reasoning or summarization</div>
        </div>
      </div>

      {/* Input Node */}
      <div
        onClick={() => handleAddNode('input')}
        onDragStart={(e) => onDragStart(e, 'input')}
        draggable
        className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-emerald-500/50 transition-all cursor-pointer active:scale-95"
      >
        <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
        <div>
          <div className="text-xs font-medium">User Input</div>
          <div className="text-[10px] text-slate-400">Raw text context or file upload</div>
        </div>
      </div>

      {/* API Fetcher Node */}
      <div
        onClick={() => handleAddNode('api')}
        onDragStart={(e) => onDragStart(e, 'api')}
        draggable
        className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-amber-500/50 transition-all cursor-pointer active:scale-95"
      >
        <Globe className="w-5 h-5 text-amber-400 shrink-0" />
        <div>
          <div className="text-xs font-medium">API Fetcher</div>
          <div className="text-[10px] text-slate-400">Fetch web links, APIs, or PDF URLs</div>
        </div>
      </div>

      {/* RAG Vector Search Node */}
      <div
        onClick={() => handleAddNode('rag')}
        onDragStart={(e) => onDragStart(e, 'rag')}
        draggable
        className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-amber-500/50 transition-all cursor-pointer active:scale-95"
      >
        <Search className="w-5 h-5 text-amber-400 shrink-0" />
        <div>
          <div className="text-xs font-medium">RAG Filter</div>
          <div className="text-[10px] text-slate-400">Semantic topic & passage search</div>
        </div>
      </div>

      {/* Output Node */}
      <div
        onClick={() => handleAddNode('output')}
        onDragStart={(e) => onDragStart(e, 'output')}
        draggable
        className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-purple-500/50 transition-all cursor-pointer active:scale-95"
      >
        <Terminal className="w-5 h-5 text-purple-400 shrink-0" />
        <div>
          <div className="text-xs font-medium">Final Output</div>
          <div className="text-[10px] text-slate-400">Displays terminal step results</div>
        </div>
      </div>
    </aside>
  );
}