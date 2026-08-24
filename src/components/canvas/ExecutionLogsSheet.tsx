'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCanvasStore } from '@/lib/hooks/useCanvasStore';
import { Terminal, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface LogItem {
  id: string;
  node_id: string;
  node_label: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  log_data: {
    input_context?: string;
    output?: string;
  };
  created_at: string;
}

interface ExecutionLogsSheetProps {
  runId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ExecutionLogsSheet({ runId, isOpen, onClose }: ExecutionLogsSheetProps) {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  // Create the browser client once; recreating it each render would make the
  // realtime effect resubscribe on every render.
  const [supabase] = useState(() => createClient());

  // Reset logs when switching to a different run.
  useEffect(() => {
    setLogs([]);
  }, [runId]);

  useEffect(() => {
    if (!runId || !isOpen) return;

    const addLogs = (incoming: LogItem[]) => {
      setLogs((prev) => {
        const seen = new Set(prev.map((l) => l.id));
        const merged = [...prev];
        for (const log of incoming) {
          if (!seen.has(log.id)) {
            merged.push(log);
            seen.add(log.id);
          }
        }
        return merged;
      });
      incoming.forEach((log) => updateNodeData(log.node_id, { status: log.status }));
    };

    // Fetch any logs already written for this run.
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('run_logs')
        .select('*')
        .eq('run_id', runId)
        .order('created_at', { ascending: true });

      if (data) addLogs(data as LogItem[]);
    };

    fetchLogs();

    // Realtime listener for logs written after we subscribed.
    const channel = supabase
      .channel(`run-logs-${runId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'run_logs',
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          addLogs([payload.new as LogItem]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [runId, isOpen, supabase, updateNodeData]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[450px] sm:w-[540px] bg-slate-900 border-slate-800 text-slate-100 flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-slate-100 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-400" /> Execution Stream
          </SheetTitle>
          <SheetDescription className="text-slate-400 text-xs">
            Run ID: {runId || 'N/A'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden mt-4">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Waiting for agent logs...
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2 font-mono"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-semibold text-blue-300">{log.node_label}</span>
                      {log.status === 'RUNNING' && (
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 flex gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Running
                        </Badge>
                      )}
                      {log.status === 'SUCCESS' && (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 flex gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </Badge>
                      )}
                      {log.status === 'FAILED' && (
                        <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 flex gap-1">
                          <XCircle className="w-3 h-3" /> Failed
                        </Badge>
                      )}
                    </div>

                    {log.log_data.input_context && (
                      <div>
                        <div className="text-slate-500 mb-1">Input Context:</div>
                        <pre className="p-2 bg-slate-900 rounded text-slate-300 overflow-x-auto whitespace-pre-wrap text-[11px]">
                          {log.log_data.input_context}
                        </pre>
                      </div>
                    )}

                    {log.log_data.output && (
                      <div>
                        <div className="text-slate-500 mb-1">Agent Output:</div>
                        <pre className="p-2 bg-slate-900 rounded text-emerald-300 overflow-x-auto whitespace-pre-wrap text-[11px]">
                          {log.log_data.output}
                        </pre>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}