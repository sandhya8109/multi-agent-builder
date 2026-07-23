'use client';

import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Bot } from 'lucide-react';
import { useCanvasStore, AgentNodeData } from '@/lib/hooks/useCanvasStore';

export function AgentNode({ id, data }: NodeProps<{ data: AgentNodeData }>) {
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);

  const getStatusBadge = () => {
    switch (data.status) {
      case 'RUNNING':
        return <Badge className="bg-yellow-500 animate-pulse">Running</Badge>;
      case 'SUCCESS':
        return <Badge className="bg-green-600">Completed</Badge>;
      case 'FAILED':
        return <Badge className="bg-red-600">Failed</Badge>;
      default:
        return <Badge variant="outline">Idle</Badge>;
    }
  };

  return (
    <Card className="w-80 shadow-lg border-2 border-slate-700 bg-slate-900 text-slate-100">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500" />
      
      <CardHeader className="p-3 border-b border-slate-800 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-400" />
          <CardTitle className="text-sm font-semibold">{data.label}</CardTitle>
        </div>
        {getStatusBadge()}
      </CardHeader>

      <CardContent className="p-3 space-y-3">
        <div>
          <label className="text-xs text-slate-400 font-medium">Role / Task Name</label>
          <Input
            value={data.role || ''}
            onChange={(e) => updateNodeData(id, { role: e.target.value })}
            placeholder="e.g., Data Extractor"
            className="h-8 text-xs bg-slate-800 border-slate-700 mt-1"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 font-medium">System Instructions</label>
          <Textarea
            value={data.systemPrompt || ''}
            onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value })}
            placeholder="You are an expert summary agent..."
            className="text-xs bg-slate-800 border-slate-700 mt-1 resize-none h-16"
          />
        </div>
      </CardContent>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500" />
    </Card>
  );
}