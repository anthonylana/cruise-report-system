import { useId, type ReactNode } from 'react';

type Props = { title: string; children: ReactNode };

/** A titled block. aria-labelledby makes it a named "region" (screen readers + tests). */
export function DetailSection({ title, children }: Props) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
