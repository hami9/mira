import { useId, useRef, useState } from 'react';
import type { CannedResponseDto } from '@mira/shared-types';
import { useApiClient } from '../api-context';

interface CannedResponsesPickerProps {
  onPick: (content: string) => void;
}

export function CannedResponsesPicker({ onPick }: CannedResponsesPickerProps) {
  const apiClient = useApiClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [responses, setResponses] = useState<CannedResponseDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');

  async function loadResponses() {
    setLoading(true);
    setError(false);
    try {
      setResponses(await apiClient.listCannedResponses());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const needle = query.trim().toLocaleLowerCase('fa-IR');
  const matches = responses?.filter((response) =>
    `${response.title}\n${response.content}`.toLocaleLowerCase('fa-IR').includes(needle),
  );

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setQuery('');
          dialog.current?.showModal();
          if (!responses && !loading) void loadResponses();
        }}
        className="control-button"
      >
        پاسخ آماده
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="w-[min(480px,calc(100vw-24px))] max-h-[85dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-right text-slate-800 shadow-2xl backdrop:bg-slate-900/40"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
          <div>
            <h2 id={titleId} className="font-bold">
              پاسخ‌های آماده
            </h2>
            <p className="mt-1 text-xs leading-6 text-slate-500">
              پاسخ را انتخاب کنید تا به متن گفتگو اضافه شود.
            </p>
          </div>
          <button
            type="button"
            className="control-button"
            aria-label="بستن پاسخ‌های آماده"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </header>
        <div className="space-y-3 p-4">
          {loading ? (
            <p role="status" className="text-xs text-slate-500">
              در حال دریافت پاسخ‌ها…
            </p>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p role="alert" className="mb-2 text-xs text-red-700">
                دریافت پاسخ‌ها انجام نشد.
              </p>
              <button type="button" className="control-button" onClick={() => void loadResponses()}>
                تلاش دوباره
              </button>
            </div>
          ) : responses?.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
              پاسخ آماده‌ای ثبت نشده است.
            </p>
          ) : (
            <>
              {responses && responses.length > 4 && (
                <input
                  aria-label="جست‌وجوی پاسخ آماده"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="جست‌وجو در پاسخ‌ها"
                  className="input-base min-h-11 w-full bg-white px-3 text-sm"
                />
              )}
              {matches?.length === 0 && (
                <p role="status" className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
                  پاسخی با این عبارت پیدا نشد.
                </p>
              )}
              {matches?.map((response) => (
                <button
                  key={response.id}
                  type="button"
                  onClick={() => {
                    dialog.current?.close();
                    onPick(response.content);
                  }}
                  className="block min-h-11 w-full rounded-xl border border-slate-200 bg-white p-3 text-start hover:bg-slate-50"
                >
                  <span className="block break-words text-sm font-bold">{response.title}</span>
                  <span className="mt-1 block break-words whitespace-pre-wrap text-xs leading-6 text-slate-500">
                    {response.content}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
