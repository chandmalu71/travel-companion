'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface DocumentPreviewProps {
  attachmentId: string;
  sourceType: string;
  mimeType?: string;
  emailSubject?: string;
  emailFrom?: string;
  emailDate?: string;
  onClose: () => void;
}

interface AttachmentViewData {
  id: string;
  s3Key: string | null;
  mimeType: string | null;
  previewUrl: string | null;
  downloadUrl: string | null;
  emailHtml?: string;
}

export function DocumentPreview({
  attachmentId,
  sourceType,
  mimeType,
  emailSubject,
  emailFrom,
  emailDate,
  onClose,
}: DocumentPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [viewData, setViewData] = useState<AttachmentViewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: AttachmentViewData }>(`/api/source-attachments/${attachmentId}/view`)
      .then((res) => setViewData(res.data))
      .catch(() => setError('Unable to load document preview'))
      .finally(() => setLoading(false));
  }, [attachmentId]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleOpenExternal = useCallback(() => {
    if (viewData?.downloadUrl) {
      window.open(viewData.downloadUrl, '_blank');
    } else if (viewData?.previewUrl) {
      window.open(viewData.previewUrl, '_blank');
    }
  }, [viewData]);

  const getSourceIcon = () => {
    switch (sourceType) {
      case 'email': case 'forwarded': return '📧';
      case 'receipt_scan': case 'scan': return '📷';
      case 'pdf': return '📄';
      default: return '📋';
    }
  };

  const getSourceLabel = () => {
    switch (sourceType) {
      case 'email': return 'Email Confirmation';
      case 'forwarded': return 'Forwarded Email';
      case 'receipt_scan': case 'scan': return 'Scanned Receipt';
      case 'pdf': return 'PDF Document';
      default: return 'Source Document';
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg transform transition-transform duration-300 ease-out translate-x-0">
        <div className="flex h-full flex-col bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getSourceIcon()}</span>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{getSourceLabel()}</h2>
                {emailSubject && (
                  <p className="text-xs text-gray-500 truncate max-w-[280px]">{emailSubject}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Open in app button */}
              <button
                onClick={handleOpenExternal}
                className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                title="Open in external app"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                Open Full
              </button>
              {/* Close button */}
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Metadata bar */}
          {(emailFrom || emailDate) && (
            <div className="border-b border-gray-100 px-5 py-3 bg-gray-50">
              <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                {emailFrom && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-gray-500">From:</span>
                    <span>{emailFrom}</span>
                  </div>
                )}
                {emailDate && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-gray-500">Date:</span>
                    <span>{new Date(emailDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                {mimeType && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-gray-500">Type:</span>
                    <span>{mimeType}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview content */}
          <div className="flex-1 overflow-auto">
            {loading && (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-600" />
                  <p className="text-sm text-gray-500">Loading document...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3 text-center px-6">
                  <span className="text-4xl">⚠️</span>
                  <p className="text-sm text-gray-600">{error}</p>
                  <p className="text-xs text-gray-400">The document may not be available for preview yet.</p>
                </div>
              </div>
            )}

            {!loading && !error && viewData && (
              <div className="h-full">
                {/* Email HTML preview */}
                {(sourceType === 'email' || sourceType === 'forwarded') && viewData.emailHtml && (
                  <iframe
                    srcDoc={viewData.emailHtml}
                    className="w-full h-full border-0"
                    sandbox="allow-same-origin"
                    title="Email preview"
                  />
                )}

                {/* PDF preview */}
                {(sourceType === 'pdf' || mimeType === 'application/pdf') && viewData.previewUrl && (
                  <iframe
                    src={viewData.previewUrl}
                    className="w-full h-full border-0"
                    title="PDF preview"
                  />
                )}

                {/* Image preview (scanned receipt) */}
                {(sourceType === 'receipt_scan' || sourceType === 'scan') && viewData.previewUrl && (
                  <div className="flex items-center justify-center h-full p-6 bg-gray-50">
                    <img
                      src={viewData.previewUrl}
                      alt="Scanned receipt"
                      className="max-w-full max-h-full rounded-lg shadow-md"
                    />
                  </div>
                )}

                {/* Fallback — no preview available */}
                {!viewData.emailHtml && !viewData.previewUrl && (
                  <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
                    <span className="text-5xl">{getSourceIcon()}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{getSourceLabel()}</p>
                      {emailSubject && <p className="text-xs text-gray-500 mt-1">{emailSubject}</p>}
                    </div>
                    <p className="text-xs text-gray-400 max-w-xs">
                      Preview not available. The original document is stored securely and can be downloaded when the system is connected to cloud storage.
                    </p>
                    <button
                      onClick={handleOpenExternal}
                      className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Download Original
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
