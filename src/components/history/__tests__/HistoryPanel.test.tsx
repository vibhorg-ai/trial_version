import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryPanel } from '../HistoryPanel';
import { RunListItem } from '../RunListItem';

const storeState = vi.hoisted(() => ({ runStatus: 'idle' as string }));

vi.mock('../../../lib/store/workflowStore', () => ({
  useWorkflowStore: (fn: (s: { runStatus: string }) => unknown) =>
    fn({ runStatus: storeState.runStatus }),
}));

function jsonResponse(data: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => data,
  } as Response;
}

describe('HistoryPanel', () => {
  beforeEach(() => {
    storeState.runStatus = 'idle';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ runs: [] })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns null when open is false', () => {
    const { container } = render(<HistoryPanel open={false} onClose={() => {}} workflowId="wf1" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders empty state when fetch returns no runs', async () => {
    render(<HistoryPanel open onClose={() => {}} workflowId="wf1" />);
    await waitFor(() => expect(screen.getByText(/no runs yet/i)).toBeInTheDocument());
  });

  it('renders runs when fetch returns runs', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        runs: [
          {
            id: 'r1',
            status: 'SUCCESS',
            scope: 'FULL',
            startedAt: '2024-01-01T12:00:00.000Z',
            finishedAt: '2024-01-01T12:00:01.000Z',
            selectedNodeIds: [],
          },
        ],
      }),
    );

    render(<HistoryPanel open onClose={() => {}} workflowId="wf1" />);
    await waitFor(() => expect(screen.getByText('SUCCESS')).toBeInTheDocument());
    expect(screen.getByText('FULL')).toBeInTheDocument();
  });

  it('renders error state on fetch failure', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, false));

    render(<HistoryPanel open onClose={() => {}} workflowId="wf1" />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('HTTP 500');
  });

  it('calls onClose when X is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HistoryPanel open onClose={onClose} workflowId="wf1" />);
    await user.click(screen.getByRole('button', { name: /close history panel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('refetches when runStatus changes', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse({ runs: [] }));

    const { rerender } = render(<HistoryPanel open onClose={() => {}} workflowId="wf1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/workflows/wf1/runs');

    storeState.runStatus = 'success';
    rerender(<HistoryPanel open onClose={() => {}} workflowId="wf1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

describe('RunListItem + ExpandedRunDetail', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          nodes: [
            {
              id: 'n1',
              nodeId: 'node-a',
              nodeType: 'gemini',
              status: 'SUCCESS',
              startedAt: '2024-01-01T12:00:00.000Z',
              finishedAt: '2024-01-01T12:00:02.000Z',
              inputs: null,
              output: null,
              errorMessage: null,
            },
          ],
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const sampleRun = {
    id: 'run-x',
    status: 'SUCCESS' as const,
    scope: 'FULL' as const,
    startedAt: '2024-01-01T12:00:00.000Z',
    finishedAt: '2024-01-01T12:00:05.000Z',
    selectedNodeIds: [] as string[],
  };

  it('expand toggles expanded run detail content', async () => {
    const user = userEvent.setup();
    render(
      <ul>
        <RunListItem run={sampleRun} />
      </ul>,
    );

    const rowBtn = screen.getByRole('button', { expanded: false });
    await user.click(rowBtn);
    await waitFor(() => expect(screen.getByText('gemini')).toBeInTheDocument());
    expect(document.getElementById('run-detail-run-x')).toBeTruthy();

    await user.click(screen.getByRole('button', { expanded: true }));
    await waitFor(() => expect(screen.queryByText('gemini')).not.toBeInTheDocument());
  });
});
