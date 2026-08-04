'use client';

import React from 'react';
import { WORKFLOW_TEMPLATES, WorkflowTemplate } from '@/lib/constants/templates';
import { X, Sparkles, Layers, ArrowRight } from 'lucide-react';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: WorkflowTemplate) => void;
}

export function TemplateModal({ isOpen, onClose, onSelectTemplate }: TemplateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold">Workflow Starter Templates</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          {WORKFLOW_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              className="bg-slate-950 border border-slate-800 hover:border-blue-500/50 rounded-xl p-5 flex flex-col justify-between transition-all hover:shadow-lg hover:shadow-blue-500/5 group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {tmpl.category}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" /> {tmpl.nodes.length} Nodes
                  </span>
                </div>
                <h3 className="font-bold text-slate-100 text-base mb-2 group-hover:text-blue-400 transition-colors">
                  {tmpl.name}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  {tmpl.description}
                </p>
              </div>

              <button
                onClick={() => {
                  onSelectTemplate(tmpl);
                  onClose();
                }}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-blue-600 border border-slate-800 hover:border-blue-500 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all text-slate-200 hover:text-white"
              >
                Load Template <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}