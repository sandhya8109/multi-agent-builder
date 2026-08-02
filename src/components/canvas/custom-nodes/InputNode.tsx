import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileText, Upload, Maximize2 } from 'lucide-react';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';

export function InputNode({ id, data }: { id: string; data: any }) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [textValue, setTextValue] = useState(data?.value || '');

  // Keep local state in sync when nodes load from Supabase on refresh
  useEffect(() => {
    if (data?.value !== undefined) {
      setTextValue(data.value);
    }
  }, [data?.value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTextValue(val);
    // Sync directly to Zustand store so "Save Canvas" gets the latest text
    updateNodeData(id, { value: val });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData });
      const result = await res.json();
      if (result.success) {
        setTextValue(result.text);
        updateNodeData(id, { value: result.text, fileName: result.filename });
      } else {
        alert('File upload error: ' + (result.error || 'Failed to process file'));
      }
    } catch (err) {
      alert('Failed to parse uploaded file');
    }
  };

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="w-80 rounded-xl border border-slate-700/80 bg-slate-900/95 p-3.5 text-white shadow-xl backdrop-blur-md">
      <div className="mb-2.5 flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-emerald-500/20 p-1.5 text-emerald-400">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100">{data?.title || 'User Input'}</h3>
            {data?.fileName && (
              <span className="block max-w-[140px] truncate text-[10px] text-emerald-400">
                📄 {data.fileName}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <textarea
          value={textValue}
          onChange={handleChange}
          onKeyDown={stopPropagation}
          onKeyUp={stopPropagation}
          onMouseDown={stopPropagation}
          onPointerDown={stopPropagation}
          placeholder="Paste Job Description or Resume here..."
          className="nodrag nopan h-28 w-full resize-none rounded-md border border-slate-800 bg-slate-950 p-2 text-xs text-slate-300 focus:border-emerald-500/50 focus:outline-none"
        />

        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
          <span>{textValue.length} characters</span>
          <label className="flex cursor-pointer items-center gap-1 font-semibold text-emerald-400 hover:underline">
            <Upload className="h-3 w-3" /> Upload File
            <input type="file" onChange={handleFileUpload} className="hidden" accept="*" />
          </label>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-emerald-500 !w-3 !h-3" />
    </div>
  );
}

export default InputNode;