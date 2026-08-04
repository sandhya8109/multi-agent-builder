'use client';

import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';
import { Globe, Trash2 } from 'lucide-react';

export function ApiNode({ id, data }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const nodes = useCanvasStore((s) => s.nodes);

  const handleDelete = () => {
    setNodes(nodes.filter((n) => n.id !== id));
  };

  return (
    <div className="w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden font-sans text-xs">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-slate-900"
      />

      {/* Card Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-950/60 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-slate-200">API Fetcher</span>
        </div>
        <button
          onClick={handleDelete}
          className="text-slate-500 hover:text-rose-400 transition-colors p-1"
          title="Delete Node"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Card Body */}
      <div className="p-3 space-y-3">
        {/* HTTP Method */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">
            HTTP Method
          </label>
          <select
            className="nodrag w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500 text-xs font-semibold"
            value={(data.method as string) || 'GET'}
            onChange={(e) => updateNodeData(id, { method: e.target.value })}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        {/* Endpoint URL */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">
            Endpoint URL
          </label>
          <input
            type="text"
            className="nodrag w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500 text-xs font-mono"
            value={(data.url as string) || ''}
            onChange={(e) => updateNodeData(id, { url: e.target.value })}
            placeholder="https://api.example.com/data"
          />
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-slate-900"
      />
    </div>
  );
}