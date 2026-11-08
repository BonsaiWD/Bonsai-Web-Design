import StudioOnlyNotice from '@/components/portal/admin/StudioOnlyNotice';
import PaymentSettingsView from '@/components/portal/invoices/PaymentSettingsView';
import { Page } from '@/components/portal/ui';
import { getViewer, requireAdminPage } from '@/server/portal/access';
import { adminPageMetadata } from '@/server/portal/metadata';
import { loadPaymentSettings } from '@/server/portal/features/invoices';

export const generateMetadata = adminPageMetadata('Payment settings');

export default async function SettingsPage() {
  // A client sees the same page as a missing one
  await requireAdminPage();
  // Previewing as a client: this page has no client version, so no live studio controls
  if ((await getViewer()).previewingAsClient) {
    return (
      <Page>
        <StudioOnlyNotice heading="Payment settings" />
      </Page>
    );
  }
  const { methods, version } = await loadPaymentSettings();

  return (
    <Page>
      <PaymentSettingsView methods={methods} version={version} />
    </Page>
  );
}
