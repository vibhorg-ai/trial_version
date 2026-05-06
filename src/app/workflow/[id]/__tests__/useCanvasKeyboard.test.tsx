import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useCanvasKeyboard } from '../useCanvasKeyboard';
import { createRunSliceInitial, useWorkflowStore } from '../../../../lib/store/workflowStore';

function TestHost() {
  useCanvasKeyboard();
  return null;
}

const geminiData = {
  model: 'gemini-1.5-pro',
  prompt: '',
  systemPrompt: '',
  temperature: 0.7,
  maxOutputTokens: 256,
  topP: 0.95,
};

beforeEach(() => {
  useWorkflowStore.setState({
    workflowId: 'wf1',
    name: '',
    updatedAt: null,
    nodes: [],
    edges: [],
    past: [],
    future: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    ...createRunSliceInitial(),
  });
});

describe('useCanvasKeyboard', () => {
  it('Cmd+Z calls undo', () => {
    const crop = {
      id: 'crop1',
      type: 'crop-image' as const,
      position: { x: 0, y: 0 },
      data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null as string | null },
    };
    useWorkflowStore.getState().addNode(crop);
    expect(useWorkflowStore.getState().nodes).toHaveLength(1);
    render(<TestHost />);
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(useWorkflowStore.getState().nodes).toHaveLength(0);
  });

  it('Cmd+Shift+Z calls redo', () => {
    const crop = {
      id: 'crop1',
      type: 'crop-image' as const,
      position: { x: 0, y: 0 },
      data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null as string | null },
    };
    useWorkflowStore.getState().addNode(crop);
    useWorkflowStore.getState().undo();
    expect(useWorkflowStore.getState().nodes).toHaveLength(0);
    render(<TestHost />);
    fireEvent.keyDown(window, { key: 'Z', shiftKey: true, metaKey: true });
    expect(useWorkflowStore.getState().nodes).toHaveLength(1);
  });

  it('Cmd+Y calls redo', () => {
    const crop = {
      id: 'crop1',
      type: 'crop-image' as const,
      position: { x: 0, y: 0 },
      data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null as string | null },
    };
    useWorkflowStore.getState().addNode(crop);
    useWorkflowStore.getState().undo();
    render(<TestHost />);
    fireEvent.keyDown(window, { key: 'y', metaKey: true });
    expect(useWorkflowStore.getState().nodes).toHaveLength(1);
  });

  it('Delete with selected edge calls removeEdge', () => {
    useWorkflowStore.setState({
      edges: [
        {
          id: 'e1',
          source: 'a',
          target: 'b',
          sourceHandle: 'out',
          targetHandle: 'in',
        },
      ],
      selectedEdgeId: 'e1',
    });
    render(<TestHost />);
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(useWorkflowStore.getState().edges).toHaveLength(0);
  });

  it('Backspace with selected deletable node calls removeNode', () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'gem1',
          type: 'gemini',
          position: { x: 0, y: 0 },
          data: geminiData,
        },
      ],
      selectedNodeId: 'gem1',
    });
    render(<TestHost />);
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(useWorkflowStore.getState().nodes).toHaveLength(0);
  });

  it('Delete on request-inputs (selected) does NOT call removeNode', () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'ri1',
          type: 'request-inputs',
          position: { x: 0, y: 0 },
          data: { fields: [] },
        },
      ],
      selectedNodeId: 'ri1',
    });
    render(<TestHost />);
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(useWorkflowStore.getState().nodes).toHaveLength(1);
  });

  it('Delete on response (selected) does NOT call removeNode', () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'resp1',
          type: 'response',
          position: { x: 0, y: 0 },
          data: { capturedValue: null },
        },
      ],
      selectedNodeId: 'resp1',
    });
    render(<TestHost />);
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(useWorkflowStore.getState().nodes).toHaveLength(1);
  });

  it('Delete with NO selection is a no-op', () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'gem1',
          type: 'gemini',
          position: { x: 0, y: 0 },
          data: geminiData,
        },
      ],
      selectedNodeId: null,
    });
    render(<TestHost />);
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(useWorkflowStore.getState().nodes).toHaveLength(1);
  });

  it('Delete while focus is in an input does NOT delete', () => {
    useWorkflowStore.setState({
      nodes: [
        {
          id: 'gem1',
          type: 'gemini',
          position: { x: 0, y: 0 },
          data: geminiData,
        },
      ],
      selectedNodeId: 'gem1',
    });
    render(
      <>
        <TestHost />
        <input type="text" data-testid="focused-input" />
      </>,
    );
    const input = document.querySelector('[data-testid="focused-input"]') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 'Delete' });
    expect(useWorkflowStore.getState().nodes).toHaveLength(1);
  });

  it('Cmd+Z while focus is in an input does NOT undo', () => {
    const crop = {
      id: 'crop1',
      type: 'crop-image' as const,
      position: { x: 0, y: 0 },
      data: { x: 0, y: 0, w: 100, h: 100, inputImageUrl: null as string | null },
    };
    useWorkflowStore.getState().addNode(crop);
    render(
      <>
        <TestHost />
        <input type="text" data-testid="focused-input" />
      </>,
    );
    const input = document.querySelector('[data-testid="focused-input"]') as HTMLInputElement;
    input.focus();
    fireEvent.keyDown(input, { key: 'z', metaKey: true });
    expect(useWorkflowStore.getState().nodes).toHaveLength(1);
  });
});
