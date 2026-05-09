'use client';

import Image from 'next/image';

// size="sm" → login pages (compact)
// size="lg" → sidebar (bigger)
export default function MarutiPartnerBadge({ size = 'sm' }) {
  const dim = size === 'lg' ? 130 : 90;

  return (
    <div className="flex items-center justify-center">
      <Image
        src="/images/logo/maruti-logo.jpg"
        alt="Maruti Suzuki"
        width={dim}
        height={dim}
        className="object-contain rounded-lg opacity-90 hover:opacity-100 transition-opacity"
      />
    </div>
  );
}
