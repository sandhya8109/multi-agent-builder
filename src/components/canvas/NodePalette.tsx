'use client';

import React, { useState } from 'react';
import { useCanvasStore, NodeType } from '@/lib/hooks/useCanvasStore';
import {
  Bot,
  FileText,
  Terminal,
  Globe,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaletteItem {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'agent',
    label: 'Agent Node',
    description: 'LLM worker for summarization, reasoning, or transformation.',
    icon: <Bot className="w-4 h-4 text-blue-400" />,
    color: 'border-blue-500/30 hover:border-blue-500/80 bg-blue-950/20',
  },
  {
    type: 'input',
    label: 'User Input',
    description: 'Provide raw text context or prompts to feed downstream agents.',
    icon: <FileText className="w-4 h-4 text-emerald-400" />,
    color: 'border-emerald-500/30 hover:border-emerald-500/80 bg-emerald-950/20',
  },
  {
    type: 'output',
    label: 'Final Output',
    description: 'Displays the aggregate output or terminal step result.',
    icon: <Terminal className="w-4 h-4 text-purple-400" />,
    color: 'border-purple-500/30 hover:border-purple-500/80 bg-purple-950/20',
  },
  {
    type: 'api',
    label: 'API Fetcher',
    description: 'Fetch external REST APIs or webhooks as workflow input.',
    icon: <Globe className="w-4 h-4 text-amber-400" />,
    color: 'border-amber-500/30 hover:border-amber-500/80 bg-amber-950/20',
  },
];

export function NodePalette() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const addCustomNode = useCanvasStore((s) => s.addCustomNode);

  const onDragStart = (e: React.DragEvent, nodeType: NodeType) => {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className={`relative z-20 flex flex-col h-full bg-slate-900/95 border-r border-slate-800 transition-all duration-300 backdrop-blur-md ${
        isCollapsed ? 'w-12' : 'w-64'
      }`}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800">
        {!isCollapsed && (
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Node Library
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800 ml-auto"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Palette Items List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-none">
        {PALETTE_ITEMS.map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => onDragStart(e, item.type)}
            onClick={() => addCustomNode(item.type)}
            className={`group relative flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${item.color}`}
            title={isCollapsed ? item.label : undefined}
          >
            <div className="p-1.5 rounded-md bg-slate-900 border border-slate-800 shrink-0">
              {item.icon}
            </div>

            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-200 group-hover:text-white">
                    {item.label}
                  </span>
                  <Plus className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-[10px] text-slate-400 leading-snug line-clamp-2 mt-0.5">
                  {item.description}
                </p>
              </div>
            )}

            {!isCollapsed && (
              <GripVertical className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity self-center shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}