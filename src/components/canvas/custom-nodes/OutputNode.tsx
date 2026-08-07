import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Terminal, Trash2 } from 'lucide-react';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function OutputNode({ id, data }: NodeProps) {
  const deleteNode = useCanvasStore((s: any) => s.deleteNode);
  const output = (data as any).output || (data as any).value || 'Awaiting execution output...';

  return (
    <div className="w-80 rounded-xl border border-slate-800 bg-slate-950/90 p-4 text-slate-100 backdrop-blur-md shadow-lg">
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3" />
      <div className="flex items-center justify-between mb-3 border-b border-slate-800/60 pb-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-purple-400" />
          <span className="font-semibold text-sm">{(data as any).label || 'Final Output'}</span>
        </div>
        <button
          onClick={() => deleteNode(id)}
          className="text-slate-500 hover:text-rose-400 p-1 rounded-md hover:bg-slate-800 transition-colors"
          title="Delete Node"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-1.5 text-xs">
        <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
          Workflow Result
        </label>
        <div className="max-h-56 overflow-y-auto rounded-lg bg-slate-900/90 border border-slate-800 p-3 text-xs text-slate-200 leading-relaxed scrollbar-thin">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-4 space-y-0.5 my-1.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 space-y-0.5 my-1.5">{children}</ol>,
              code: ({ children }) => (
                <code className="bg-slate-950 px-1 py-0.5 rounded text-[11px] font-mono text-purple-300">
                  {children}
                </code>
              ),
            }}
          >
            {output}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}