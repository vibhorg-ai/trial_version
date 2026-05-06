import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Galaxy.ai canvas nodes lay out each logical field as a horizontal row:
 * muted label on the left (`text-xs text-gray-500`, `pt-2`), primary control
 * on the right (`flex-1 min-w-0`). Matches the structure in
 * `scripts/.playwright-dumps/canvas-body-pretty.html` (e.g. Sora / Request).
 */
export function GalaxyFieldRow({
  label,
  required,
  children,
  className = '',
}: {
  label: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-3 ${className}`.trim()}>
      <span className="shrink-0 pt-2 text-xs text-gray-500 dark:text-zinc-400">
        {label}
        {required ? <span className="text-red-400">*</span> : null}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Dashed “slot” panel used by Galaxy for uploads, vision previews, add-item
 *  affordances (`border border-dashed border-gray-300 bg-[#F5F5F5]`). */
type GalaxyDashedPanelProps = {
  children: ReactNode;
  className?: string;
  /** Galaxy upload rows use `px-3 py-2.5`; inner grids may omit vertical padding. */
  padded?: boolean;
} & HTMLAttributes<HTMLDivElement>;

export function GalaxyDashedPanel({
  children,
  className = '',
  padded = true,
  ...rest
}: GalaxyDashedPanelProps) {
  const pad = padded ? 'px-3 py-2.5' : 'p-2';
  return (
    <div
      className={`rounded-lg border border-dashed border-gray-300 bg-[#F5F5F5] text-xs text-gray-500 transition-colors dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 ${pad} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Divider before the output / result block (`mt-4 border-t border-gray-100 pt-4`). */
export function GalaxyOutputSection({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 border-t border-gray-100 pt-4 dark:border-zinc-800">
      <div className="mb-1.5 text-xs text-gray-500 dark:text-zinc-400">{label}</div>
      {children}
    </div>
  );
}
