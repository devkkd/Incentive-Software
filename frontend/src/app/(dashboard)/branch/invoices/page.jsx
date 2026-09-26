'use client';

import InvoicesList from '@/components/InvoicesList';

// Same list as the admin portal, read-only, limited to invoices whose
// number prefix belongs to this branch (e.g. 1/… for AJM).
export default function BranchInvoicesPage() {
  return <InvoicesList isAdmin={false} />;
}
