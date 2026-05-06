// Extends the existing testing-library setup if you reuse it (we don't here
// since happy-dom isn't loaded). Add anything global integration tests need.

import { vi } from 'vitest';

// Workflow page imports CanvasShell → Canvas → reactflow CSS. Vite would run
// PostCSS on that file in the node integration environment; mock it out.
vi.mock('reactflow/dist/style.css', () => ({}));
