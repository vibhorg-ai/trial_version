export interface CropTaskPayload {
  workflowRunId: string;
  nodeId: string;
  inputImageUrl: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CropTaskResult {
  url: string;
}

export interface GeminiTaskPayload {
  workflowRunId: string;
  nodeId: string;
  prompt: string;
  systemPrompt?: string;
  temperature: number;
  maxOutputTokens: number;
  topP: number;
  visionImageUrls: string[];
}

export interface GeminiTaskResult {
  kind: 'text';
  text: string;
}

export type NodeOutput = { kind: 'text'; text: string } | { kind: 'image'; url: string };

export interface OrchestratorPayload {
  workflowRunId: string;
}
