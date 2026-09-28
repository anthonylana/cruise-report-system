import { yearOptions } from '../../utils/uploadForm';

type Props = {
  value: number;
  currentYear: number;
  disabled: boolean;
  onChange: (year: number) => void;
};

export function YearSelect({ value, currentYear, disabled, onChange }: Props) {
  const isOtherYear = value !== currentYear;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="year" className="text-sm font-medium">
        Year
      </label>
      <select
        id="year"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32 rounded border border-gray-300 px-2 py-1.5 disabled:opacity-50"
      >
        {yearOptions(currentYear).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      {isOtherYear && (
        <p className="text-sm text-amber-700">
          {value} is not the current year ({currentYear}). All files in this batch will be imported
          as {value}.
        </p>
      )}
    </div>
  );
}
