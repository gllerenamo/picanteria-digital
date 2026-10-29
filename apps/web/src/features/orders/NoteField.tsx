import { NOTES_MAX } from '@picanteria/shared';
import { useId } from 'react';

/** Nota opcional de un ítem (por ejemplo, "sin ají"), con contador de 140 caracteres. */
export function NoteField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-lg font-medium">
        Nota (opcional)
      </label>
      <textarea
        id={id}
        value={value}
        maxLength={NOTES_MAX}
        rows={2}
        placeholder="Por ejemplo: sin ají"
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="min-h-11 rounded-lg border border-line px-3 py-2 text-lg"
      />
      <span className="self-end text-sm text-muted">
        {value.length}/{NOTES_MAX}
      </span>
    </div>
  );
}
