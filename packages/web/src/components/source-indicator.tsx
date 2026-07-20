'use client';

interface SourceAttachment {
  id: string;
  sourceType: string;
  mimeType?: string;
  emailSubject?: string;
  emailFrom?: string;
  emailDate?: string;
}

interface SourceIndicatorProps {
  source?: string;
  sourceAttachment?: SourceAttachment;
  bookingId?: string;
  className?: string;
}

const sourceConfig: Record<string, { icon: string; label: string; color: string }> = {
  email: { icon: '📧', label: 'Email', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  receipt_scan: { icon: '📷', label: 'Scanned Receipt', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  scan: { icon: '📷', label: 'Scanned', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  pdf: { icon: '📄', label: 'PDF Upload', color: 'bg-red-50 text-red-700 border-red-200' },
  forwarded: { icon: '📧', label: 'Forwarded Email', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  manual: { icon: '✍️', label: 'Manual Entry', color: 'bg-gray-50 text-gray-600 border-gray-200' },
  api: { icon: '🔗', label: 'Connected Service', color: 'bg-green-50 text-green-700 border-green-200' },
};

export function SourceIndicator({ source, sourceAttachment, bookingId, className = '' }: SourceIndicatorProps) {
  if (!source) return null;

  const displayType = sourceAttachment?.sourceType ?? source;
  const config = sourceConfig[displayType] ?? sourceConfig.manual;

  return (
    <div className={`flex items-center justify-between mt-3 pt-3 border-t border-gray-100 ${className}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.color}`}>
          <span>{config.icon}</span>
          <span>Source: {config.label}</span>
        </span>
        {sourceAttachment?.emailSubject && (
          <span className="text-xs text-gray-400 truncate max-w-[180px]" title={sourceAttachment.emailSubject}>
            &quot;{sourceAttachment.emailSubject}&quot;
          </span>
        )}
      </div>
      {sourceAttachment && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Open attachment viewer modal or link
            if (bookingId) {
              window.open(`/api/source-attachments/${sourceAttachment.id}/view`, '_blank');
            }
          }}
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.813a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364l1.757 1.757" />
          </svg>
          View Original
        </button>
      )}
    </div>
  );
}
