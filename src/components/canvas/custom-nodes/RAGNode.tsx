import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Input } from '@/components/ui/input';
import { Search, Trash2 } from 'lucide-react';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';

export function RAGNode({ id, data }: NodeProps) {
  const updateNodeData = useCanvasStore((s: any) => s.updateNodeData);
  const deleteNode = useCanvasStore((s: any) => s.deleteNode);

  return (
    <div className="w-80 rounded-xl border border-slate-800 bg-slate-950/90 p-4 text-slate-100 backdrop-blur-md shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3" />

      <div className="flex items-center justify-between mb-3 border-b border-slate-800/60 pb-2">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-amber-400" />
          <span className="font-semibold text-sm">{(data as any).label || 'RAG Vector Filter'}</span>
        </div>
        <button
          onClick={() => deleteNode(id)}
          className="text-slate-500 hover:text-rose-400 p-1 rounded-md hover:bg-slate-800 transition-colors"
          title="Delete Node"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
            Search Query / Topic
          </label>
          <Input
            value={(data as any).query || ''}
            onChange={(e) => updateNodeData(id, { query: e.target.value })}
            placeholder="e.g., habit loop, system vs goals"
            className="h-8 bg-slate-900 border-slate-800 text-xs text-slate-200"
          />
        </div>

        <div>
          <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
            Top Passages to Extract (Top K)
          </label>
          <Input
            type="number"
            min="1"
            max="10"
            value={(data as any).topK || 3}
            onChange={(e) => updateNodeData(id, { topK: parseInt(e.target.value) || 3 })}
            className="h-8 bg-slate-900 border-slate-800 text-xs text-slate-200"
          />
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-3 !h-3" />
    </div>
  );
}