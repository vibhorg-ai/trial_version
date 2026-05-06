'use client';

import { useState } from 'react';
import type { NodeProps } from 'reactflow';
import type { z } from 'zod';
import { FileText, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { BaseNodeShell } from './BaseNodeShell';
import { listHandles } from '../../../lib/dag/handles';
import type { WorkflowNode } from '../../../lib/schemas/node';
import { RequestInputsNodeDataSchema } from '../../../lib/schemas/node';
import { useWorkflowStore } from '../../../lib/store/workflowStore';
import { TransloaditUpload } from './TransloaditUpload';

type RequestInputsNodeData = z.infer<typeof RequestInputsNodeDataSchema>;

function toWorkflowNode(id: string, data: RequestInputsNodeData): WorkflowNode {
  return { id, type: 'request-inputs', position: { x: 0, y: 0 }, data };
}

function newFieldName(): string {
  return `field_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

export function RequestInputsNode({ id, data, selected }: NodeProps<RequestInputsNodeData>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const nodeRunStatus = useWorkflowStore((s) => s.nodeRunStatus[id] ?? 'idle');
  const baseShellStatus = nodeRunStatus === 'skipped' ? 'idle' : nodeRunStatus;
  const wfNode = toWorkflowNode(id, data);
  const handles = listHandles(wfNode);
  const [addOpen, setAddOpen] = useState(false);

  const addTextField = () => {
    updateNodeData(id, {
      fields: [...data.fields, { fieldType: 'text_field', name: newFieldName(), value: '' }],
    });
  };

  const addImageField = () => {
    updateNodeData(id, {
      fields: [...data.fields, { fieldType: 'image_field', name: newFieldName(), value: null }],
    });
  };

  return (
    <BaseNodeShell
      title="Request Inputs"
      subtitle="Workflow inputs"
      icon={<FileText className="h-4 w-4" aria-hidden />}
      handles={handles}
      selected={selected}
      runStatus={baseShellStatus}
    >
      <div className="flex flex-col gap-3">
        {data.fields.map((field, index) => (
          <div
            key={`field-${index}`}
            data-testid={`request-field-row-${field.name}`}
            className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-2"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-zinc-600">
                {field.fieldType === 'text_field' ? (
                  <FileText className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <ImageIcon className="h-4 w-4 shrink-0" aria-hidden />
                )}
                <input
                  aria-label="Field name"
                  className="w-full min-w-0 rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-900"
                  value={field.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const fields = data.fields.map((f, i) => (i === index ? { ...f, name } : f));
                    updateNodeData(id, { fields });
                  }}
                />
              </div>
              <button
                type="button"
                className="rounded p-1 text-zinc-500 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`Remove field ${field.name}`}
                disabled={data.fields.length <= 1}
                onClick={() => {
                  const fields = data.fields.filter((_, i) => i !== index);
                  updateNodeData(id, { fields });
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {field.fieldType === 'text_field' ? (
              <textarea
                aria-label={`Value for ${field.name}`}
                className="min-h-[72px] w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-800"
                value={field.value}
                onChange={(e) => {
                  const value = e.target.value;
                  const fields = data.fields.map((f, i) =>
                    i === index && f.fieldType === 'text_field' ? { ...f, value } : f,
                  );
                  updateNodeData(id, { fields });
                }}
              />
            ) : (
              <TransloaditUpload
                value={field.value}
                onUpload={(url) => {
                  const fields = data.fields.map((f, i) =>
                    i === index && f.fieldType === 'image_field' ? { ...f, value: url } : f,
                  );
                  updateNodeData(id, { fields });
                }}
                onClear={() => {
                  const fields = data.fields.map((f, i) =>
                    i === index && f.fieldType === 'image_field' ? { ...f, value: null } : f,
                  );
                  updateNodeData(id, { fields });
                }}
              />
            )}
          </div>
        ))}

        <div className="relative">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-violet-200 bg-violet-50/50 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-50"
            onClick={() => setAddOpen((o) => !o)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add field
          </button>
          {addOpen ? (
            <div
              role="menu"
              data-testid="add-field-menu"
              className="absolute left-0 top-full z-10 mt-1 flex min-w-[180px] flex-col rounded-lg border border-zinc-200 bg-white py-1 shadow-md"
            >
              <button
                type="button"
                role="menuitem"
                data-testid="add-text-field"
                className="px-3 py-2 text-left text-xs hover:bg-zinc-50"
                onClick={() => {
                  addTextField();
                  setAddOpen(false);
                }}
              >
                Add text field
              </button>
              <button
                type="button"
                role="menuitem"
                data-testid="add-image-field"
                className="px-3 py-2 text-left text-xs hover:bg-zinc-50"
                onClick={() => {
                  addImageField();
                  setAddOpen(false);
                }}
              >
                Add image field
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </BaseNodeShell>
  );
}
