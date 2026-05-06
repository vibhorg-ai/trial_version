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

const FIELD_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function fieldNameError(name: string, allNames: string[], index: number): string | null {
  if (name.length === 0) return 'Required';
  if (!FIELD_NAME_RE.test(name)) return 'Letters, digits, _ only; cannot start with a digit';
  const dupIndex = allNames.findIndex((n, i) => n === name && i !== index);
  if (dupIndex !== -1) return 'Duplicate name';
  return null;
}

export function RequestInputsNode({ id, data }: NodeProps<RequestInputsNodeData>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const isSelected = useWorkflowStore((s) => s.selectedNodeId === id);
  const nodeRunStatus = useWorkflowStore((s) => s.nodeRunStatus[id] ?? 'idle');
  const baseShellStatus = nodeRunStatus === 'skipped' ? 'idle' : nodeRunStatus;
  const wfNode = toWorkflowNode(id, data);
  const handles = listHandles(wfNode);
  const [addOpen, setAddOpen] = useState(false);
  const allNames = data.fields.map((f) => f.name);

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
      title="Request-Inputs"
      tooltip="Define the input fields for your workflow. These become the request parameters when running via Playground or API."
      handles={handles}
      selected={isSelected}
      runStatus={baseShellStatus}
    >
      <div className="flex w-full flex-col gap-4">
        {data.fields.map((field, index) => {
          const nameErr = fieldNameError(field.name, allNames, index);
          return (
            <div
              key={`field-${index}`}
              data-testid={`request-field-row-${field.name}`}
              className="flex w-full min-w-0 flex-col gap-2"
            >
              <div className="flex w-full min-w-0 items-center gap-2">
                {field.fieldType === 'text_field' ? (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                )}
                <input
                  aria-label="Field name"
                  aria-invalid={nameErr ? 'true' : 'false'}
                  className={`flex-1 min-w-0 rounded-md border bg-white px-2 py-1 text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none ${nameErr ? 'border-red-300' : 'border-gray-200'}`}
                  value={field.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const fields = data.fields.map((f, i) => (i === index ? { ...f, name } : f));
                    updateNodeData(id, { fields });
                  }}
                />
                <button
                  type="button"
                  className="nodrag flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={`Remove field ${field.name}`}
                  disabled={data.fields.length <= 1}
                  onClick={() => {
                    const fields = data.fields.filter((_, i) => i !== index);
                    updateNodeData(id, { fields });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              {nameErr ? (
                <span
                  data-testid={`field-name-error-${index}`}
                  className="text-[10px] text-red-600"
                >
                  {nameErr}
                </span>
              ) : null}
              {field.fieldType === 'text_field' ? (
                <textarea
                  aria-label={`Value for ${field.name}`}
                  placeholder="Enter text..."
                  rows={3}
                  className="nodrag nowheel w-full min-w-0 resize-y rounded-lg border border-gray-200 bg-[#F5F5F5] px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500"
                  value={field.value}
                  onMouseDown={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
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
          );
        })}

        <div className="relative pt-0.5">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-1 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50"
            onClick={() => setAddOpen((o) => !o)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add field
          </button>
          {addOpen ? (
            <div
              role="menu"
              data-testid="add-field-menu"
              className="absolute left-0 top-full z-10 mt-1 flex min-w-[160px] flex-col rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                data-testid="add-text-field"
                className="px-3 py-1.5 text-left text-[12px] text-zinc-700 hover:bg-zinc-50"
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
                className="px-3 py-1.5 text-left text-[12px] text-zinc-700 hover:bg-zinc-50"
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
