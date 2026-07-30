import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Terminal } from 'lucide-react';

export function OutputNode({ data }: NodeProps) {
  const output = (data as any).output || (data as any).value || 'Awaiting execution output...';

  return (
    <div className="w-80 rounded-xl border border-slate-800 bg-slate-950/90 p-4 text-slate-100 backdrop-blur-md shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-3 border-b border-slate-800/60 pb-2">
        <Terminal className="w-4 h-4 text-purple-400" />
        <span className="font-semibold text-sm">{(data as any).label || 'Final Output'}</span>
      </div>
      <div className="space-y-1.5 text-xs">
        <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
          Workflow Result
        </label>
        <div className="max-h-48 overflow-y-auto rounded-lg bg-slate-900/90 border border-slate-800 p-2.5 text-xs text-slate-300 font-mono whitespace-pre-wrap scrollbar-thin">
          {output}
        </div>
      </div>
    </div>
  );
}