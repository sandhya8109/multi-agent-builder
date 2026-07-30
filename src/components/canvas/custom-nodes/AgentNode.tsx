import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Bot, CheckCircle2, Loader2, XCircle, Trash2, Sliders } from 'lucide-react';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function AgentNode({ id, data }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const deleteNode = useCanvasStore((s) => s.deleteNode);

  const status = (data as any).status || 'IDLE';
  const model = (data as any).model || 'llama-3.3-70b-versatile';
  const temperature = (data as any).temperature ?? 0.7;

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
          {/* Execution Metrics Badge */}
          {(data as any).metrics && (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-2 py-1 rounded text-[10px] text-slate-400 font-mono mt-2">
              <span>⚡ {(data as any).metrics.latency}</span>
              <span>•</span>
              <span>🎟️ {(data as any).metrics.tokens} tokens</span>
            </div>
          )}
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
            placeholder="e.g. Content Refiner"
            className="h-8 bg-slate-900 border-slate-800 text-xs text-slate-200"
          />
        </div>

        {/* Model Selector & Temperature Controls */}
        <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
          <div>
            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => updateNodeData(id, { model: e.target.value })}
              className="w-full h-7 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-200 px-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
              <option value="llama3-8b-8192">Llama 3.1 8B</option>
              <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
              <option value="gpt-4o">GPT-4o (OpenAI)</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Sliders className="w-2.5 h-2.5 text-blue-400" /> Temp
              </label>
              <span className="text-[10px] text-slate-300 font-mono">{temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => updateNodeData(id, { temperature: parseFloat(e.target.value) })}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 mt-2"
            />
          </div>
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

        {/* Rich Markdown Output Block */}
        {(data as any).output && (
          <div>
            <label className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider block mb-1">
              Output Generated
            </label>
            <div className="max-h-48 overflow-y-auto rounded-lg bg-slate-900 border border-slate-800 p-2.5 text-xs text-slate-200 leading-relaxed scrollbar-thin">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-4 space-y-0.5 my-1.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 space-y-0.5 my-1.5">{children}</ol>,
                  code: ({ children }) => (
                    <code className="bg-slate-950 px-1 py-0.5 rounded text-[11px] font-mono text-amber-300">
                      {children}
                    </code>
                  ),
                }}
              >
                {(data as any).output}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
}