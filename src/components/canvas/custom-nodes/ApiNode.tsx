import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Input } from '@/components/ui/input';
import { Globe } from 'lucide-react';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';

export function ApiNode({ id, data }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  return (
    <div className="w-80 rounded-xl border border-slate-800 bg-slate-950/90 p-4 text-slate-100 backdrop-blur-md shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-3 border-b border-slate-800/60 pb-2">
        <Globe className="w-4 h-4 text-amber-400" />
        <span className="font-semibold text-sm">{(data as any).label || 'API Fetcher'}</span>
      </div>
      <div className="space-y-2 text-xs">
        <div>
          <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
            HTTP Method
          </label>
          <select
            value={(data as any).method || 'GET'}
            onChange={(e) => updateNodeData(id, { method: e.target.value })}
            className="w-full h-8 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
            Endpoint URL
          </label>
          <Input
            value={(data as any).url || ''}
            onChange={(e) => updateNodeData(id, { url: e.target.value })}
            placeholder="https://api.example.com/data"
            className="h-8 bg-slate-900 border-slate-800 text-xs text-slate-200 font-mono"
          />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-3 !h-3" />
    </div>
  );
}