'use client';

import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';
import { Bot, Trash2, CheckCircle2, Loader2, AlertCircle, Play } from 'lucide-react';

export function AgentNode({ id, data }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges); // Required to trace parent connections

  const handleDelete = () => {
    setNodes(nodes.filter((n) => n.id !== id));
  };

  const handleTestSingleNode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    updateNodeData(id, { status: 'RUNNING' });

    try {
      const res = await fetch('/api/workflows/test-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: id, nodes, edges }),
      });

      const result = await res.json();

      if (res.ok && result.output) {
        updateNodeData(id, { status: 'SUCCESS', output: result.output });
      } else {
        console.error('Test node execution failed:', result.error);
        updateNodeData(id, { status: 'FAILED' });
      }
    } catch (err) {
      console.error('Failed to run test node:', err);
      updateNodeData(id, { status: 'FAILED' });
    }
  };

  const status = (data.status as string) || 'IDLE';

  return (
    <div className="w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden font-sans text-xs">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-slate-900"
      />

      {/* Card Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-950/60 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-slate-200">
            {(data.label as string) || 'Agent Node'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {status === 'SUCCESS' && (
            <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-medium">
              <CheckCircle2 className="w-3 h-3" /> Done
            </span>
          )}
          {status === 'RUNNING' && (
            <span className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-medium">
              <Loader2 className="w-3 h-3 animate-spin" /> Running
            </span>
          )}
          {status === 'FAILED' && (
            <span className="flex items-center gap-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full text-[10px] font-medium">
              <AlertCircle className="w-3 h-3" /> Error
            </span>
          )}

          {/* Play Button */}
          <button
            onClick={handleTestSingleNode}
            className="p-1 text-slate-400 hover:text-emerald-400 transition-colors rounded hover:bg-slate-800"
            title="Run this node with all upstream context"
          >
            <Play className="w-3.5 h-3.5" />
          </button>

          {/* Delete Button */}
          <button
            onClick={handleDelete}
            className="p-1 text-slate-500 hover:text-rose-400 transition-colors rounded hover:bg-slate-800"
            title="Delete Node"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-3 space-y-3">
        {/* Role / Task Name */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">
            Role / Task Name
          </label>
          <input
            type="text"
            className="nodrag w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
            value={(data.label as string) || ''}
            onChange={(e) => updateNodeData(id, { label: e.target.value })}
            placeholder="e.g. Assistant"
          />
        </div>

        {/* Model & Temp Controls */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">
              Model
            </label>
            <select
              className="nodrag w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
              value={(data.model as string) || 'openai/gpt-oss-20b'}
              onChange={(e) => updateNodeData(id, { model: e.target.value })}
            >
              <option value="openai/gpt-oss-20b">Groq: GPT-OSS 20B (fast)</option>
              <option value="openai/gpt-oss-120b">Groq: GPT-OSS 120B</option>
              <option value="qwen/qwen3.6-27b">Groq: Qwen 3.6 27B</option>
              <option value="groq/compound">Groq: Compound</option>
              <option value="gpt-4o-mini">OpenAI: GPT-4o Mini</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                Temp
              </label>
              <span className="text-[10px] text-slate-400">
                {(data.temperature as number) ?? 0.7}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              className="nodrag w-full accent-blue-500 h-1.5 bg-slate-800 rounded cursor-pointer mt-2"
              value={(data.temperature as number) ?? 0.7}
              onChange={(e) =>
                updateNodeData(id, { temperature: parseFloat(e.target.value) })
              }
            />
          </div>
        </div>

        {/* System Instructions */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">
            System Instructions
          </label>
          <textarea
            rows={3}
            className="nodrag w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none focus:border-blue-500 resize-none font-mono text-[11px]"
            value={(data.instructions as string) || ''}
            onChange={(e) => updateNodeData(id, { instructions: e.target.value })}
            placeholder="Enter system instructions..."
          />
        </div>

        {/* Output Generated */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">
            Output Generated
          </label>
          <div className="nodrag w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 font-mono text-[11px] min-h-[60px] max-h-[120px] overflow-y-auto whitespace-pre-wrap">
            {(data.output as string) || (
              <span className="text-slate-600 italic">No output generated yet...</span>
            )}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-slate-900"
      />
    </div>
  );
}