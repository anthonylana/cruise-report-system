/** [label, already-formatted value]. Values are strings so "—" handling stays in utils/format. */
export type Field = readonly [label: string, value: string];

type Props = { fields: readonly Field[] };

/** Label/value pairs as a two-column <dl>. */
export function FieldList({ fields }: Props) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
      {fields.map(([label, value]) => (
        // `contents`: the wrapper div doesn't take part in the grid layout.
        <div key={label} className="contents">
          <dt className="font-medium text-slate-600">{label}</dt>
          <dd className="whitespace-pre-line">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
