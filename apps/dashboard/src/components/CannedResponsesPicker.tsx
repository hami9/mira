import { useEffect, useState } from 'react';
import type { CannedResponseDto } from '@mira/shared-types';
import { apiClient } from '../api';

interface CannedResponsesPickerProps {
  onPick: (content: string) => void;
}

export function CannedResponsesPicker({ onPick }: CannedResponsesPickerProps) {
  const [open, setOpen] = useState(false);
  const [responses, setResponses] = useState<CannedResponseDto[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open && !loaded) {
      apiClient.listCannedResponses().then((data) => {
        setResponses(data);
        setLoaded(true);
      });
    }
  }, [open, loaded]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="border-l border-gray-200 px-3 text-xs text-gray-600 hover:bg-gray-50"
      >
        پاسخ آماده
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-1 max-h-56 w-64 overflow-y-auto rounded border border-gray-200 bg-white shadow-lg">
          {responses.length === 0 && (
            <div className="p-3 text-xs text-gray-400">پاسخ آماده‌ای ثبت نشده</div>
          )}
          {responses.map((response) => (
            <button
              key={response.id}
              type="button"
              onClick={() => {
                onPick(response.content);
                setOpen(false);
              }}
              className="block w-full border-b border-gray-100 p-2 text-right text-xs hover:bg-gray-50"
            >
              <div className="font-medium text-gray-800">{response.title}</div>
              <div className="truncate text-gray-500">{response.content}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
