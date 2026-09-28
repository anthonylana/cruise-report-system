import type { ChangeEvent } from 'react';

type Props = {
  disabled: boolean;
  onSelect: (files: File[]) => void;
};

export function FilePicker({ disabled, onSelect }: Props) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onSelect(Array.from(e.target.files ?? []));
    // Allows re-selecting the same file(s) later; we show the selection ourselves.
    e.target.value = '';
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="files" className="text-sm font-medium">
        Excel files (.xls)
      </label>
      <input
        id="files"
        type="file"
        multiple
        accept=".xls,application/vnd.ms-excel"
        disabled={disabled}
        onChange={handleChange}
        className="text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-white disabled:opacity-50"
      />
    </div>
  );
}
