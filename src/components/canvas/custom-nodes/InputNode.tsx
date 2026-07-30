import React, { useRef, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Trash2, Upload, Loader2 } from 'lucide-react';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';

export function InputNode({ id, data }: NodeProps) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: formData,
        });
        const json = await res.json();
        if (json.text) {
          updateNodeData(id, { value: json.text });
        }
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          updateNodeData(id, { value: content });
        };
        reader.readAsText(file);
      }
    } catch (err) {
      console.error('File read error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-80 rounded-xl border border-slate-800 bg-slate-950/90 p-4 text-slate-100 backdrop-blur-md shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 border-b border-slate-800/60 pb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-sm">{(data as any).label || 'User Input'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="text-slate-400 hover:text-emerald-400 p-1 rounded-md hover:bg-slate-800 transition-colors flex items-center gap-1 text-[10px]"
            title="Upload Local File (.pdf, .txt, .csv, .json)"
          >
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            Upload
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.txt,.csv,.json,.md"
            className="hidden"
          />

          <button
            onClick={() => deleteNode(id)}
            className="text-slate-500 hover:text-rose-400 p-1 rounded-md hover:bg-slate-800 transition-colors"
            title="Delete Node"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Input Box */}
      <div className="space-y-1.5 text-xs">
        <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
          Input Text / File Content
        </label>
        <Textarea
          value={(data as any).value || ''}
          onChange={(e) => updateNodeData(id, { value: e.target.value })}
          placeholder="Type text here OR click 'Upload' to import a PDF / TXT file..."
          rows={5}
          className="bg-slate-900 border-slate-800 text-xs text-slate-200 resize-none font-mono scrollbar-thin"
        />
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-3 !h-3" />
    </div>
  );
}