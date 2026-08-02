import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot, Maximize2 } from 'lucide-react';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';

export function AgentNode({ id, data }: { id: string; data: any }) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [instructions, setInstructions] = useState(data?.instructions || '');

  useEffect(() => {
    if (data?.instructions !== undefined) {
      setInstructions(data.instructions);
    }
  }, [data?.instructions]);

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInstructions(val);
    updateNodeData(id, { instructions: val });
  };

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="w-80 rounded-xl border border-slate-700/80 bg-slate-900/95 p-3.5 text-white shadow-xl backdrop-blur-md">
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-3 !h-3" />

      <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-500/20 p-1.5 text-blue-400">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100">{data?.roleName || 'Agent Node'}</h3>
            <span className="text-[10px] text-slate-400">LLM worker</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            System Instructions
          </label>
          <textarea
            value={instructions}
            onChange={handleInstructionsChange}
            onKeyDown={stopPropagation}
            onKeyUp={stopPropagation}
            onMouseDown={stopPropagation}
            onPointerDown={stopPropagation}
            className="nodrag nopan h-24 w-full resize-none rounded-md border border-slate-800 bg-slate-950 p-2 text-xs text-slate-300 focus:border-blue-500/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Output Generated
          </label>
          <div className="h-20 w-full overflow-y-auto rounded-md border border-slate-800 bg-slate-950 p-2 text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
            {data?.output || <span className="text-slate-600 italic">Outputs will appear here...</span>}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
}

export default AgentNode;