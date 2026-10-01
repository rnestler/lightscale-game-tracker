import { i18n } from '../i18n/text';
import type { JSX } from 'react';
import { usePermissions, canReadField } from '../hooks/usePermissions';
import type * as $Domain from '../types/domain';
import { PencilIcon, Trash2Icon, UserIcon, XIcon } from 'lucide-react';
import { apiBaseUrl } from '../config/apiConfig';
import { StaleDataPanel } from './StaleDataPanel';
import { RichTextDisplay } from '../components/ui/form-field';
import { RecordChip } from '../components/ui/record-chip';
import { useUsers } from '../hooks/useUsers';

export function PlayerDetailBody({
  player,
  onEdit,
  onDelete,
  onClose,
  hideClose,
}: {
  player: $Domain.Player;
  onEdit?: (record: $Domain.Player) => void;
  onDelete?: (id: string) => void;
  onClose?: () => void;
  hideClose?: boolean;
  onTransactionSuccess?: () => void;
}): JSX.Element {
  const { permissions } = usePermissions();
  const { userLabel } = useUsers();
  return (
    <div className="flex flex-col" aria-label={''} data-ls="bc07bba128">
      {player.avatar?.mimeType.startsWith('image/') && (
        <img
          src={`${apiBaseUrl}/api/files/${player.avatar.id}/download?v=${encodeURIComponent(player.avatar.fileName)}`}
          alt={''}
          className="w-full aspect-[3/1] object-cover"
          data-ls="d32e20d7c4"
        />
      )}
      <div
        className="flex flex-row items-start gap-4 border-b border-border p-6"
        data-ls="f80a6886b2"
      >
        <div
          className="w-11 h-11 rounded-lg bg-primary/10 text-foreground flex items-center justify-center flex-shrink-0"
          data-ls="58ea1a0fd6"
        >
          <UserIcon className="h-5 w-5" />
        </div>
        <div
          className="flex flex-col gap-1 flex-1 min-w-0 flex-wrap [&>*]:max-w-full"
          data-ls="e0230d5e6e"
        >
          <span
            className="min-w-min text-sm uppercase tracking-wide font-semibold text-muted-foreground"
            data-ls="d484bfbf68"
          >
            {i18n.word('Player')}
          </span>
          <span className="min-w-min text-2xl font-semibold" data-ls="d89ee5a7ba">
            {player.nickname}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-5 p-6" data-ls="88a678713d">
        <div
          className="@container overflow-x-auto flex flex-col gap-4 p-5 rounded-xl border border-border bg-card"
          data-ls="b6a5ed63e4"
        >
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 @md:grid-cols-2" data-ls="5de3215652">
            {canReadField(permissions, 'players', 'fullName') && player.fullName ? (
              <div className="flex flex-col gap-1" data-ls="cbb25117c6">
                <span
                  className="min-w-min text-xs font-medium text-muted-foreground"
                  data-ls="9b4bcf5522"
                >
                  {i18n.word('Player.fullName')}
                </span>
                <span className="min-w-min text-sm" data-ls="971d32d289">
                  {player.fullName}
                </span>
              </div>
            ) : null}
            {canReadField(permissions, 'players', 'emailAddress') && player.emailAddress ? (
              <div className="flex flex-col gap-1" data-ls="dd5331fa0b">
                <span
                  className="min-w-min text-xs font-medium text-muted-foreground"
                  data-ls="77b4deb424"
                >
                  {i18n.word('Player.emailAddress')}
                </span>
                {player.emailAddress && (
                  <a
                    href={`mailto:${player.emailAddress}`}
                    className="min-w-0 break-all text-sm"
                    data-ls="4415088b6b"
                  >
                    {player.emailAddress}
                  </a>
                )}
              </div>
            ) : null}
            {canReadField(permissions, 'players', 'joinedDate') && player.joinedDate ? (
              <div className="flex flex-col gap-1" data-ls="0781eda6f8">
                <span
                  className="min-w-min text-xs font-medium text-muted-foreground"
                  data-ls="344fa71ed3"
                >
                  {i18n.word('Player.joinedDate')}
                </span>
                <span className="shrink-0 whitespace-nowrap text-sm" data-ls="9b5f9c5933">
                  {player.joinedDate
                    ? new Date(`${player.joinedDate}T00:00:00`).toLocaleDateString(i18n.locale)
                    : ''}
                </span>
              </div>
            ) : null}
            {canReadField(permissions, 'players', 'avatar') && (
              <div className="flex flex-col gap-1" data-ls="631340c519">
                <span
                  className="min-w-min text-xs font-medium text-muted-foreground"
                  data-ls="0a028f974f"
                >
                  {i18n.word('Player.avatar')}
                </span>
                {player.avatar &&
                  (player.avatar.mimeType.startsWith('image/') ? (
                    <img
                      src={`${apiBaseUrl}/api/files/${player.avatar.id}/download?v=${encodeURIComponent(player.avatar.fileName)}`}
                      alt={player.avatar.fileName}
                      loading="lazy"
                      className="h-10 w-10 rounded-md object-cover"
                    />
                  ) : (
                    <a
                      href={`${apiBaseUrl}/api/files/${player.avatar.id}/download?v=${encodeURIComponent(player.avatar.fileName)}`}
                      download
                      className="min-w-min text-sm"
                      data-ls="de68bc75df"
                    >
                      {player.avatar.fileName}
                    </a>
                  ))}
              </div>
            )}
            {canReadField(permissions, 'players', 'userAccountId') && player.userAccountId ? (
              <div className="flex flex-col gap-1" data-ls="a8e17e0173">
                <span
                  className="min-w-min text-xs font-medium text-muted-foreground"
                  data-ls="eb0226658e"
                >
                  {i18n.word('Player.userAccount')}
                </span>
                {player.userAccountId ? (
                  <RecordChip
                    label={userLabel(player.userAccountId)}
                    initials
                    className="min-w-min text-sm"
                    data-ls="cb536b6098"
                  />
                ) : null}
              </div>
            ) : null}
            {canReadField(permissions, 'players', 'bio') && player.bio ? (
              <div className="flex flex-col gap-1 @md:col-span-2" data-ls="98222f3cd1">
                <span
                  className="min-w-min text-xs font-medium text-muted-foreground"
                  data-ls="32ba0a5d3f"
                >
                  {i18n.word('Player.bio')}
                </span>
                <RichTextDisplay
                  value={player.bio}
                  className="min-w-min text-sm"
                  data-ls="e043bd9111"
                />
              </div>
            ) : null}
          </div>
        </div>
        <StaleDataPanel
          table="Player"
          recordId={player.id}
          visibleColumns={[
            'nickname',
            'fullName',
            'emailAddress',
            'avatar',
            'bio',
            'joinedDate',
            'userAccountId',
          ]}
        />
        <div
          className="flex flex-row min-w-0 flex-wrap [&>*]:max-w-full items-center justify-end gap-3"
          data-ls="4e81aaba23"
        >
          {onClose && !hideClose && (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md hover:bg-secondary hover:text-secondary-foreground"
              onClick={() => {
                onClose();
              }}
            >
              <XIcon className="h-4 w-4" />
              {i18n.chrome.close}
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md hover:bg-secondary hover:text-secondary-foreground"
              onClick={() => {
                onEdit(player);
                onClose?.();
              }}
            >
              <PencilIcon className="h-4 w-4" />
              {i18n.chrome.edit}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 px-3 py-2 rounded-md text-destructive-text hover:bg-destructive/10"
              onClick={() => {
                onDelete(player.id);
                onClose?.();
              }}
            >
              <Trash2Icon className="h-4 w-4" />
              {i18n.chrome.delete}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
