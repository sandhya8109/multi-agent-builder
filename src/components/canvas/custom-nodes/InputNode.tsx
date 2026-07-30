import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Textarea } from '@/components/ui/textarea';
import { Text } from 'lucide-react';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';

export function InputNode({ id, data }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const inputValue = (data as any).value || (data as any).input || '';

  return (
    <div className="w-80 rounded-xl border border-slate-800 bg-slate-950/90 p-4 text-slate-100 backdrop-blur-md shadow-lg">
      {/* Card Header */}
      <div className="flex items-center gap-2 mb-3 border-b border-slate-800/60 pb-2">
        <Text className="w-4 h-4 text-emerald-400" />
        <span className="font-semibold text-sm">{(data as any).label || 'User Input'}</span>
      </div>

      {/* Editable Input Box */}
      <div className="space-y-1.5 text-xs">
        <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
          Input Text / Context
        </label>
        <Textarea
          value={inputValue}
          onChange={(e) => updateNodeData(id, { value: e.target.value })}
          placeholder="Paste or type context text here..."
          rows={4}
          className="bg-slate-900 border-slate-800 text-xs text-slate-200 resize-none font-normal"
        />
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-3 !h-3" />
    </div>
  );
}