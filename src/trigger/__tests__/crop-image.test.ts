import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  waitFor: vi.fn(async () => {}),
  spawnFfmpegProcess: vi.fn(),
  removeTmpCalls: [] as string[],
}));

vi.mock('@trigger.dev/sdk', () => ({
  task: <P, R>(opts: { id: string; run: (p: P, c: unknown) => Promise<R> }) => ({
    id: opts.id,
    run: opts.run,
  }),
  wait: { for: mocks.waitFor },
  tasks: { trigger: vi.fn(async () => ({ id: 'run_x' })) },
}));

vi.mock('../spawn-ffmpeg', () => ({
  spawnFfmpegProcess: mocks.spawnFfmpegProcess,
}));

vi.mock('../fs-tmp', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../fs-tmp')>();
  return {
    removeTmpDir: async (p: string) => {
      mocks.removeTmpCalls.push(p);
      return actual.removeTmpDir(p);
    },
  };
});

import { cropImageTask } from '../crop-image';
import type { CropTaskPayload, CropTaskResult } from '../types';

type CropTaskWithRun = {
  run: (payload: CropTaskPayload, options: { ctx: unknown }) => Promise<CropTaskResult>;
};

const runCrop = cropImageTask as unknown as CropTaskWithRun;

function emitCloseSoon(code: number) {
  return (ffmpegPath: string, args: string[]) => {
    const child = new EventEmitter() as ChildProcess;
    queueMicrotask(async () => {
      if (code === 0) {
        const outputPath = args[args.length - 1];
        await writeFile(outputPath, Buffer.from('mock-image-bytes'));
      }
      child.emit('close', code);
    });
    return child;
  };
}

describe('cropImageTask', () => {
  beforeEach(() => {
    vi.stubEnv('TRANSLOADIT_AUTH_SECRET', 'secret');
    vi.stubEnv('TRANSLOADIT_AUTH_KEY', 'key');
    vi.stubEnv('FFMPEG_PATH', '/bin/ffmpeg');
    mocks.waitFor.mockClear();
    mocks.spawnFfmpegProcess.mockClear();
    mocks.removeTmpCalls.length = 0;
    mocks.spawnFfmpegProcess.mockImplementation(emitCloseSoon(0));
    vi.stubGlobal('fetch', vi.fn() as unknown as typeof fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('calls wait.for with at least 30 seconds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1]).buffer,
    } as Response);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: { step: [{ ssl_url: 'https://cdn.example/out.jpg' }] } }),
    } as Response);

    await runCrop.run(
      {
        workflowRunId: 'wr1',
        nodeId: 'n1',
        inputImageUrl: 'https://example.com/in.jpg',
        x: 0,
        y: 0,
        w: 100,
        h: 100,
      },
      { ctx: {} } as never,
    );

    const waitCalls = mocks.waitFor.mock.calls as unknown as Array<[{ seconds: number }]>;
    expect(waitCalls[0][0].seconds).toBeGreaterThanOrEqual(30);
  });

  it('spawns ffmpeg with crop filter matching payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1]).buffer,
    } as Response);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: { step: [{ ssl_url: 'https://cdn.example/out.jpg' }] } }),
    } as Response);

    await runCrop.run(
      {
        workflowRunId: 'wr1',
        nodeId: 'n1',
        inputImageUrl: 'https://example.com/in.jpg',
        x: 5,
        y: 10,
        w: 200,
        h: 150,
      },
      { ctx: {} } as never,
    );

    const spawnCall = mocks.spawnFfmpegProcess.mock.calls.at(-1);
    expect(spawnCall).toBeDefined();
    const args = spawnCall![1];
    expect(args).toEqual(
      expect.arrayContaining([
        '-y',
        '-i',
        expect.any(String),
        '-vf',
        'crop=200:150:5:10',
        expect.any(String),
      ]),
    );
    expect(mocks.spawnFfmpegProcess.mock.calls.at(-1)![0]).toBe('/bin/ffmpeg');
  });

  it('uploads cropped file and returns Transloadit URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([9, 9]).buffer,
    } as Response);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: { ':original': [{ ssl_url: 'https://cdn.test/final.png' }] } }),
    } as Response);

    const result = await runCrop.run(
      {
        workflowRunId: 'wr1',
        nodeId: 'n1',
        inputImageUrl: 'https://example.com/in.jpg',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
      },
      { ctx: {} } as never,
    );

    expect(result.url).toBe('https://cdn.test/final.png');
    const uploadCall = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).includes('transloadit.com/assemblies'));
    expect(uploadCall).toBeDefined();
    expect(mocks.removeTmpCalls.length).toBe(1);
  });

  it('cleans up temp directory even when ffmpeg fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1]).buffer,
    } as Response);
    mocks.spawnFfmpegProcess.mockImplementation(emitCloseSoon(1));

    await expect(
      runCrop.run(
        {
          workflowRunId: 'wr1',
          nodeId: 'n1',
          inputImageUrl: 'https://example.com/in.jpg',
          x: 0,
          y: 0,
          w: 10,
          h: 10,
        },
        { ctx: {} } as never,
      ),
    ).rejects.toThrow(/ffmpeg exited/);

    expect(mocks.removeTmpCalls.length).toBeGreaterThan(0);
    expect(mocks.removeTmpCalls[0]).toEqual(expect.stringMatching(/nextflow-crop-/));
  });
});
