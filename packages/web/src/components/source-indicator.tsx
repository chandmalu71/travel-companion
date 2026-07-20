'use client';

import { useState } from 'react';
import { DocumentPreview } from './document-preview';

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

const sourceConfig: Record<string, { icon: string; label: string; color: string; hoverColor: string }> = {
  email: { icon: '📧', label: 'Email', color: 'bg-blue-50 text-blue-700 border-blue-200', hoverColor: 'hover:bg-blue-100 hover:border-blue-300' },
  receipt_scan: { icon: '📷', label: 'Scanned Receipt', color: 'bg-purple-50 text-purple-700 border-purple-200', hoverColor: 'hover:bg-purple-100 hover:border-purple-300' },
  scan: { icon: '📷', label: 'Scanned', color: 'bg-purple-50 text-purple-700 border-purple-200', hoverColor: 'hover:bg-purple-100 hover:border-purple-300' },
  pdf: { icon: '📄', label: 'PDF Upload', color: 'bg-red-50 text-red-700 border-red-200', hoverColor: 'hover:bg-red-100 hover:border-red-300' },
  forwarded: { icon: '📧', label: 'Forwarded Email', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', hoverColor: 'hover:bg-indigo-100 hover:border-indigo-300' },
  manual: { icon: '✍️', label: 'Manual Entry', color: 'bg-gray-50 text-gray-600 border-gray-200', hoverColor: 'hover:bg-gray-100 hover:border-gray-300' },
  api: { icon: '🔗', label: 'Connected Service', color: 'bg-green-50 text-green-700 border-green-200', hoverColor: 'hover:bg-green-100 hover:border-green-300' },
};

export function SourceIndicator({ source, sourceAttachment, bookingId, className = '' }: SourceIndicatorProps) {
  const [showPreview, setShowPreview] = useState(false);

  if (!source) return null;

  const displayType = sourceAttachment?.sourceType ?? source;
  const config = sourceConfig[displayType] ?? sourceConfig.manual;
  const isClickable = !!sourceAttachment;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (sourceAttachment) {
      setShowPreview(true);
    }
  };

  return (
    <>
      <div className={`flex items-center justify-between mt-3 pt-3 border-t border-gray-100 ${className}`}>
        <button
          onClick={handleClick}
          disabled={!isClickable}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${config.color} ${isClickable ? `${config.hoverColor} cursor-pointer shadow-sm hover:shadow` : 'cursor-default'}`}
          title={isClickable ? `View source: ${config.label}` : `Source: ${config.label}`}
        >
          <span>{config.icon}</span>
          <span>Source: {config.label}</span>
          {isClickable && (
            <svg className="h-3 w-3 ml-0.5 opacity-60" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          )}
        </button>

        {sourceAttachment?.emailSubject && (
          <span className="text-xs text-gray-400 truncate max-w-[180px] hidden sm:inline" title={sourceAttachment.emailSubject}>
            &quot;{sourceAttachment.emailSubject}&quot;
          </span>
        )}
      </div>

      {/* Document preview slide-over */}
      {showPreview && sourceAttachment && (
        <DocumentPreview
          attachmentId={sourceAttachment.id}
          sourceType={displayType}
          mimeType={sourceAttachment.mimeType}
          emailSubject={sourceAttachment.emailSubject}
          emailFrom={sourceAttachment.emailFrom}
          emailDate={sourceAttachment.emailDate}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}
