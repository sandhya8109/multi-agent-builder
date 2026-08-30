/**
 * Single source of truth for matching a workflow node's `type` string to
 * the kind of node it is. Every node type has a canonical long form
 * ('agentNode', 'inputNode', ...) plus legacy short forms ('agent',
 * 'input', ...) that older saved workflows, or nodes created before the
 * NodePalette rename, may still contain — match both everywhere instead of
 * re-deriving this list per file (that divergence was the root cause of
 * "Run Workflow" silently doing nothing for hand-built workflows).
 */

export const isAgentNode = (t?: string) => t === 'agentNode' || t === 'agent';
export const isInputNode = (t?: string) => t === 'inputNode' || t === 'input' || t === 'userInput';
export const isApiNode = (t?: string) => t === 'apiNode' || t === 'apiFetcher' || t === 'api';
export const isRagNode = (t?: string) => t === 'ragNode' || t === 'rag';
export const isOutputNode = (t?: string) => t === 'outputNode' || t === 'output';
