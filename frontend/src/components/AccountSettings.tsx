import { i18n } from '../i18n/text';
import type { JSX } from 'react';
import { useState } from 'react';
import { useSetupStatus } from '../api/setupStatus';
import { usePermissions } from '../hooks/usePermissions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { KeyRoundIcon, LockIcon, ShieldCheckIcon, Trash2Icon } from 'lucide-react';
import { ChangePasswordSettings } from './auth/ChangePasswordSettings';
import { PasskeySettings } from './auth/PasskeySettings';
import { TwoFactorSettings } from './auth/TwoFactorSettings';
import { DeleteAccountSettings } from './auth/DeleteAccountSettings';
import { PrivacySettings } from './auth/PrivacySettings';

export function AccountSettings(): JSX.Element {
  const { capabilities } = useSetupStatus();
  const { isAdmin, allowAccountDeletion } = usePermissions();
  const canDeleteAccount = allowAccountDeletion && !isAdmin;
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    'password' | 'passkeys' | '2fa' | 'privacy' | 'account'
  >('password');
  return (
    <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 lg:py-8 xl:py-10">
      <Tabs
        value={activeSettingsTab}
        onValueChange={(value) => {
          setActiveSettingsTab(value as 'password' | 'passkeys' | '2fa' | 'privacy' | 'account');
        }}
        orientation="vertical"
        className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)] gap-6 lg:gap-8 xl:gap-10"
      >
        <aside className="lg:sticky lg:top-14 lg:h-fit">
          <div className="border-b lg:border-b-0 lg:border-r border-border pb-4 lg:pb-0 lg:pr-6 xl:pr-8">
            <p className="text-sm text-muted-foreground mb-6 lg:mb-8">
              {i18n.chrome.settingsSubtitle}
            </p>
            <TabsList className="flex lg:flex-col gap-1.5 bg-transparent p-0 h-auto max-lg:overflow-x-auto max-lg:-mx-4 max-lg:px-4">
              <TabsTrigger
                value="password"
                className="shrink-0 whitespace-nowrap lg:w-full justify-start gap-2 px-3 lg:px-4 h-10 rounded-md text-sm font-medium text-muted-foreground hover:text-accent-foreground hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <LockIcon className="h-4 w-4" />
                {i18n.chrome.changePasswordTab}
              </TabsTrigger>
              {capabilities.passkeys && (
                <TabsTrigger
                  value="passkeys"
                  className="shrink-0 whitespace-nowrap lg:w-full justify-start gap-2 px-3 lg:px-4 h-10 rounded-md text-sm font-medium text-muted-foreground hover:text-accent-foreground hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <KeyRoundIcon className="h-4 w-4" />
                  {i18n.chrome.passkeysTab}
                </TabsTrigger>
              )}
              {capabilities.twoFactor && (
                <TabsTrigger
                  value="2fa"
                  className="shrink-0 whitespace-nowrap lg:w-full justify-start gap-2 px-3 lg:px-4 h-10 rounded-md text-sm font-medium text-muted-foreground hover:text-accent-foreground hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <ShieldCheckIcon className="h-4 w-4" />
                  {i18n.chrome.twoFactorTab}
                </TabsTrigger>
              )}
              <TabsTrigger
                value="privacy"
                className="shrink-0 whitespace-nowrap lg:w-full justify-start gap-2 px-3 lg:px-4 h-10 rounded-md text-sm font-medium text-muted-foreground hover:text-accent-foreground hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <ShieldCheckIcon className="h-4 w-4" />
                {i18n.chrome.privacyTab}
              </TabsTrigger>
              {canDeleteAccount && (
                <TabsTrigger
                  value="account"
                  className="shrink-0 whitespace-nowrap lg:w-full justify-start gap-2 px-3 lg:px-4 h-10 rounded-md text-sm font-medium text-muted-foreground hover:text-accent-foreground hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Trash2Icon className="h-4 w-4" />
                  {i18n.chrome.deleteAccountTab}
                </TabsTrigger>
              )}
            </TabsList>
          </div>
        </aside>
        <section>
          <div>
            <div className="border border-border bg-card p-6 lg:p-8 xl:p-10 rounded-lg">
              <TabsContent value="password">
                <ChangePasswordSettings />
              </TabsContent>
              {capabilities.passkeys && (
                <TabsContent value="passkeys">
                  <PasskeySettings />
                </TabsContent>
              )}
              {capabilities.twoFactor && (
                <TabsContent value="2fa">
                  <TwoFactorSettings />
                </TabsContent>
              )}
              <TabsContent value="privacy">
                <PrivacySettings canRequestErasure={true} />
              </TabsContent>
              {canDeleteAccount && (
                <TabsContent value="account">
                  <DeleteAccountSettings />
                </TabsContent>
              )}
            </div>
          </div>
        </section>
      </Tabs>
    </div>
  );
}
