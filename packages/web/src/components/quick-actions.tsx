'use client';

interface QuickActionsProps {
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  bookingId?: string;
  className?: string;
}

export function QuickActions({ address, latitude, longitude, phone, bookingId, className = '' }: QuickActionsProps) {
  const hasLocation = latitude && longitude;
  const hasAddress = !!address;
  const hasPhone = !!phone;

  if (!hasLocation && !hasAddress && !hasPhone) return null;

  const getNavigateUrl = () => {
    if (hasLocation) return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    if (hasAddress) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address!)}`;
    return '#';
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Booking Details',
      url: window.location.href,
    };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => {});
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div className={`flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100 ${className}`}>
      {(hasLocation || hasAddress) && (
        <a
          href={getNavigateUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
          title="Get directions"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
          </svg>
          Navigate
        </a>
      )}

      {hasPhone && (
        <a
          href={`tel:${phone}`}
          className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
          title={`Call ${phone}`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
          </svg>
          Call
        </a>
      )}

      <button
        onClick={handleShare}
        className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        title="Share"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
        </svg>
        Share
      </button>
    </div>
  );
}
