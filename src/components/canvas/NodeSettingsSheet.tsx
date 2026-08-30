'use client';

import React from 'react';
import { Settings2, X, Sliders, Cpu, Link as LinkIcon, FileText } from 'lucide-react';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';

interface NodeSettingsSheetProps {
  nodeId: string | null;
  onClose: () => void;
}

export function NodeSettingsSheet({ nodeId, onClose }: NodeSettingsSheetProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const selectedNode = nodes.find((n) => n.id === nodeId);

  if (!nodeId || !selectedNode) return null;

  const data: any = selectedNode.data || {};

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col font-sans transition-all">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-slate-100 capitalize">
            Configure {selectedNode.type} Node
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Settings Forms */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-300">
        {/* AGENT NODE CONFIG */}
        {(selectedNode.type === 'agentNode' || selectedNode.type === 'agent') && (
          <>
            <div>
              <label className="block mb-1.5 font-medium text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-400" /> LLM Model
              </label>
              <select
                value={data.model || 'openai/gpt-oss-20b'}
                onChange={(e) => updateNodeData(selectedNode.id, { model: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="openai/gpt-oss-20b">Groq (gpt-oss-20b, fast)</option>
                <option value="openai/gpt-oss-120b">Groq (gpt-oss-120b, quality)</option>
                <option value="qwen/qwen3.8-27b">Groq (qwen3.8-27b)</option>
                <option value="gpt-4o-mini">OpenAI (gpt-4o-mini)</option>
              </select>
            </div>

            <div>
              <label className="block mb-1.5 font-medium text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" /> Temperature
                </span>
                <span className="text-slate-200">{data.temperature ?? 0.7}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={data.temperature ?? 0.7}
                onChange={(e) => updateNodeData(selectedNode.id, { temperature: parseFloat(e.target.value) })}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="block mb-1.5 font-medium text-slate-400">System Instructions</label>
              <textarea
                rows={5}
                value={data.instructions || ''}
                onChange={(e) => updateNodeData(selectedNode.id, { instructions: e.target.value })}
                placeholder="Specify task instructions for this agent..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 resize-none font-mono text-[11px]"
              />
            </div>
          </>
        )}

        {/* API NODE CONFIG */}
        {(selectedNode.type === 'apiNode' || selectedNode.type === 'api') && (
          <div>
            <label className="block mb-1.5 font-medium text-slate-400 flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-amber-400" /> API Endpoint URL
            </label>
            <input
              type="text"
              value={data.url || data.endpoint || ''}
              onChange={(e) => updateNodeData(selectedNode.id, { url: e.target.value })}
              placeholder="https://api.example.com/data"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-[11px]"
            />
          </div>
        )}

        {/* RAG NODE CONFIG */}
        {(selectedNode.type === 'ragNode' || selectedNode.type === 'rag') && (
          <>
            <div>
              <label className="block mb-1.5 font-medium text-slate-400">Search Query / Keyword</label>
              <input
                type="text"
                value={data.query || ''}
                onChange={(e) => updateNodeData(selectedNode.id, { query: e.target.value })}
                placeholder="Filter passages matching this term..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block mb-1.5 font-medium text-slate-400">Top-K Passages to Keep</label>
              <input
                type="number"
                min="1"
                max="10"
                value={data.topK || 3}
                onChange={(e) => updateNodeData(selectedNode.id, { topK: parseInt(e.target.value) || 3 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </>
        )}

        {/* INPUT NODE CONFIG */}
        {(selectedNode.type === 'inputNode' || selectedNode.type === 'input') && (
          <div>
            <label className="block mb-1.5 font-medium text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-400" /> Input Context Text
            </label>
            <textarea
              rows={8}
              value={data.value || ''}
              onChange={(e) => updateNodeData(selectedNode.id, { value: e.target.value })}
              placeholder="Paste raw text context or input prompt here..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 resize-none font-mono text-[11px]"
            />
          </div>
        )}
      </div>
    </div>
  );
}