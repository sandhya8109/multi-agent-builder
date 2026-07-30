import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Bot, CheckCircle2, Loader2, XCircle, Trash2 } from 'lucide-react';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';

export function AgentNode({ id, data }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const deleteNode = useCanvasStore((s) => s.deleteNode);

  const status = (data as any).status || 'IDLE';

  return (
    <div className="w-80 rounded-xl border border-slate-800 bg-slate-950/90 p-4 text-slate-100 backdrop-blur-md shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 border-b border-slate-800/60 pb-2">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-sm">{(data as any).label || 'Agent'}</span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'RUNNING' && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-800/50">
              <Loader2 className="w-3 h-3 animate-spin" /> Running
            </span>
          )}
          {status === 'SUCCESS' && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-800/50">
              <CheckCircle2 className="w-3 h-3" /> Done
            </span>
          )}
          {status === 'FAILED' && (
            <span className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-800/50">
              <XCircle className="w-3 h-3" /> Failed
            </span>
          )}

          {/* Delete Button */}
          <button
            onClick={() => deleteNode(id)}
            className="text-slate-500 hover:text-rose-400 p-1 rounded-md hover:bg-slate-800 transition-colors"
            title="Delete Node"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Form Controls */}
      <div className="space-y-3 text-xs">
        <div>
          <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
            Role / Task Name
          </label>
          <Input
            value={(data as any).role || ''}
            onChange={(e) => updateNodeData(id, { role: e.target.value })}
            placeholder="e.g. Code Reviewer"
            className="h-8 bg-slate-900 border-slate-800 text-xs text-slate-200"
          />
        </div>

        <div>
          <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
            System Instructions
          </label>
          <Textarea
            value={(data as any).systemPrompt || ''}
            onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value })}
            placeholder="Describe what this agent should do..."
            rows={3}
            className="bg-slate-900 border-slate-800 text-xs text-slate-200 resize-none"
          />
        </div>

        {(data as any).output && (
          <div>
            <label className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider block mb-1">
              Output Generated
            </label>
            <div className="max-h-40 overflow-y-auto rounded-lg bg-slate-900 border border-slate-800 p-2 text-[11px] text-slate-300 whitespace-pre-wrap font-sans">
              {(data as any).output}
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
}