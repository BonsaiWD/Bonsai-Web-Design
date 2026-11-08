import type { Metadata } from 'next';
import PaymentSettingsView from '@/components/portal/invoices/PaymentSettingsView';
import { Page } from '@/components/portal/ui';
import { requireAdminPage } from '@/server/portal/access';
import { loadPaymentSettings } from '@/server/portal/features/invoices';

export const metadata: Metadata = { title: 'Payment settings' };

export default async function SettingsPage() {
  // A client sees the same page as a missing one
  await requireAdminPage();
  const { methods, version } = await loadPaymentSettings();

  return (
    <Page>
      <PaymentSettingsView methods={methods} version={version} />
    </Page>
  );
}
