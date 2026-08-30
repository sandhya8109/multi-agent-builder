/**
 * Shared message contract for workflow nodes/edges.
 *
 * This is the schema every part of the system — the canvas UI, the
 * Supabase `workflows.nodes`/`workflows.edges` columns, the DAG executor,
 * and the API routes — agrees on. Do not pass ad hoc untyped objects
 * between these layers; extend `WorkflowNodeData` instead.
 *
 * Node `type` accepts both the canonical long form ('agentNode', etc.)
 * and legacy short forms ('agent', etc.) that older saved workflows may
 * still contain, so existing data keeps working. New nodes should always
 * be created with the long form — see NodePalette.tsx.
 */

export type WorkflowNodeType =
  | 'agentNode'
  | 'agent'
  | 'inputNode'
  | 'input'
  | 'userInput'
  | 'apiNode'
  | 'apiFetcher'
  | 'api'
  | 'ragNode'
  | 'rag'
  | 'outputNode'
  | 'output';

export type NodeExecutionStatus = 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'ERROR';

export interface WorkflowNodeData {
  label?: string;
  status?: NodeExecutionStatus;
  output?: string;
  errorMessage?: string | null;

  // Agent node
  model?: string;
  temperature?: number;
  instructions?: string;
  role?: string;

  // Input node
  value?: string;
  fileName?: string;

  // API node
  url?: string;
  method?: string;

  // RAG node
  query?: string;
  topK?: number;

  // Allow node-specific fields not yet promoted to this shared contract
  // without breaking the build; prefer adding them above when stabilized.
  [key: string]: unknown;
}

export interface WorkflowNode {
  id: string;
  type?: WorkflowNodeType | string;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}

/** Per-node execution result, used for logging and API responses. */
export interface NodeExecutionLog {
  nodeId: string;
  nodeLabel: string;
  status: NodeExecutionStatus;
  inputContext: string;
  output: string;
  startedAt: string;
  finishedAt: string;
  error?: string;
}

export interface WorkflowExecutionResult {
  nodes: WorkflowNode[];
  outputs: Record<string, string>;
  logs: NodeExecutionLog[];
}
