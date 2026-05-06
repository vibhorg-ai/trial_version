import { Crop, Sparkles, Video, Music, FileText, type LucideIcon } from 'lucide-react';
import type { WorkflowNode } from '../../../lib/schemas/node';
import { DEFAULT_GEMINI_MODEL_ID } from '../../../lib/gemini-model';

export type CatalogTab = 'recent' | 'image' | 'video' | 'audio' | 'llms' | 'others';

export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  tab: CatalogTab;
  icon: LucideIcon;
  enabled: boolean;
  create?: (id: string, position: { x: number; y: number }) => WorkflowNode;
}

export const CATALOG: CatalogEntry[] = [
  {
    id: 'crop-image',
    name: 'Crop Image',
    description: 'Crop an image to a rectangular region using FFmpeg.',
    tab: 'image',
    icon: Crop,
    enabled: true,
    create: (id, position) => ({
      id,
      type: 'crop-image',
      position,
      data: {
        x: 0,
        y: 0,
        w: 100,
        h: 100,
        inputImageUrl: null,
      },
    }),
  },
  {
    id: 'gemini-3.1-pro',
    name: 'Gemini',
    description: `Run a ${DEFAULT_GEMINI_MODEL_ID} text/vision generation step.`,
    tab: 'llms',
    icon: Sparkles,
    enabled: true,
    create: (id, position) => ({
      id,
      type: 'gemini',
      position,
      data: {
        model: DEFAULT_GEMINI_MODEL_ID,
        prompt: '',
        systemPrompt: '',
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.95,
      },
    }),
  },
  {
    id: 'video-trim',
    name: 'Trim Video',
    description: 'Coming soon.',
    tab: 'video',
    icon: Video,
    enabled: false,
  },
  {
    id: 'audio-transcribe',
    name: 'Transcribe Audio',
    description: 'Coming soon.',
    tab: 'audio',
    icon: Music,
    enabled: false,
  },
  {
    id: 'extract-text',
    name: 'Extract Text',
    description: 'Coming soon.',
    tab: 'others',
    icon: FileText,
    enabled: false,
  },
];

export const TABS: Array<{ id: CatalogTab; label: string }> = [
  { id: 'recent', label: 'Recent' },
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: 'llms', label: 'LLMs' },
  { id: 'others', label: 'Others' },
];
