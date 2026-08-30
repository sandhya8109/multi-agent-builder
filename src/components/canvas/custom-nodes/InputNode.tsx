import React, { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileText, Upload, AlertCircle } from 'lucide-react';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';

export function InputNode({ id, data }: { id: string; data: any }) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [textValue, setTextValue] = useState(data?.value || '');

  const isError = data?.status === 'ERROR' || Boolean(data?.errorMessage);

  // Keep local state in sync when nodes load from Supabase on refresh
  useEffect(() => {
    if (data?.value !== undefined) {
      setTextValue(data.value);
    }
  }, [data?.value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTextValue(val);
    
    // Clear error status immediately upon user editing
    updateNodeData(id, { 
      value: val,
      status: 'IDLE',
      errorMessage: null
    });
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
        updateNodeData(id, { 
          value: result.text, 
          fileName: result.filename,
          status: 'IDLE',
          errorMessage: null 
        });
      } else {
        alert('File upload error: ' + (result.error || 'Failed to process file'));
      }
    } catch (err) {
      alert('Failed to parse uploaded file');
    }
  };

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      className={`w-80 rounded-xl border bg-slate-900/95 p-3.5 text-white shadow-xl backdrop-blur-md transition-all duration-200 ${
        isError
          ? 'border-red-500/80 shadow-lg shadow-red-500/20'
          : 'border-slate-700/80'
      }`}
    >
      <div className="mb-2.5 flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div
            className={`rounded-lg p-1.5 transition-colors ${
              isError ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
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

        {isError && (
          <div className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
            <AlertCircle className="h-3 w-3" />
            <span>Data Required</span>
          </div>
        )}
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
          className={`nodrag nopan h-28 w-full resize-none rounded-md border bg-slate-950 p-2 text-xs text-slate-300 transition-colors focus:outline-none ${
            isError
              ? 'border-red-500/80 focus:border-red-500'
              : 'border-slate-800 focus:border-emerald-500/50'
          }`}
        />

        {isError && data?.errorMessage && (
          <p className="text-[11px] font-medium leading-snug text-red-400">
            {data.errorMessage}
          </p>
        )}

        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
          <span>{textValue.length} characters</span>
          <label className="flex cursor-pointer items-center gap-1 font-semibold text-emerald-400 hover:underline">
            <Upload className="h-3 w-3" /> Upload File
            <input type="file" onChange={handleFileUpload} className="hidden" accept="*" />
          </label>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-emerald-500" />
    </div>
  );
}

export default InputNode;