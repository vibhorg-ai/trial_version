export const PENDING_WORKFLOW_ID_PREFIX = '__pending:';

export function isPendingWorkflowId(id: string): boolean {
  return id.startsWith(PENDING_WORKFLOW_ID_PREFIX);
}
