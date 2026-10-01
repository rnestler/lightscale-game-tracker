import { i18n } from '../i18n/text';
import { useState, type JSX } from 'react';
import { usePlayers } from '../hooks/usePlayers';
import { useAvailability } from '../hooks/useAvailability';
import { Input } from './ui/input';
import { FormField, FormDatePicker, FormRichTextEditor, FormUserSelect } from './ui/form-field';
import { FileUpload } from './ui/file-upload';
import type { FileUploadValue, FileValue } from '../types/file';
import { usePermissions } from '../hooks/usePermissions';
import { refusalFieldErrors, runWithToast } from '../utils/errorHandling';
import type * as $Domain from '../types/domain';
import { Loader2Icon } from 'lucide-react';
import { apiBaseUrl } from '../config/apiConfig';
import { toast } from '../utils/toast';
import { Button } from './ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  focusFirstField,
} from './ui/dialog';
type FormErrors = Partial<Record<string, string>>;
export interface PlayerDraft extends Omit<$Domain.Player, 'avatar'> {
  avatar: FileUploadValue | FileValue | null;
}
interface PlayerEditDialogProps {
  open: boolean;
  editing: PlayerDraft | null;
  isBusy: boolean;
  onClose: () => void;
  onSaved?: () => void;
  defaults?: Partial<{
    nickname: string;
    fullName: string;
    emailAddress: string;
    joinedDate: string;
    avatar: FileUploadValue | FileValue | null;
    userAccountId: string;
    bio: string;
  }>;
  onSave?: (data: {
    nickname: string;
    fullName: string;
    emailAddress: string;
    joinedDate: string;
    avatar: FileUploadValue | FileValue | null;
    userAccountId: string;
    bio: string;
  }) => Promise<{ id: string } | void>;
}

export function PlayerEditDialog({
  open,
  editing,
  isBusy,
  onClose,
  onSaved,
  onSave,
  defaults = {},
}: PlayerEditDialogProps): JSX.Element {
  const { permissions } = usePermissions();
  const { reloadPlayers, createPlayer, updatePlayer } = usePlayers({ autoLoad: false });
  const canSubmitEditPlayer = editing
    ? (permissions?.['players']?.update ?? false)
    : (permissions?.['players']?.create ?? false);
  const [editPlayerNickname$, setEditPlayerNickname$] = useState(defaults.nickname ?? '');
  const [editPlayerFullName$, setEditPlayerFullName$] = useState(defaults.fullName ?? '');
  const [editPlayerEmailAddress$, setEditPlayerEmailAddress$] = useState(
    defaults.emailAddress ?? ''
  );
  const [editPlayerJoinedDate$, setEditPlayerJoinedDate$] = useState(
    defaults.joinedDate ?? new Date().toISOString().split('T')[0]
  );
  const [editPlayerAvatar$, setEditPlayerAvatar$] = useState<FileUploadValue | FileValue | null>(
    null
  );
  const [editPlayerUserAccount$, setEditPlayerUserAccount$] = useState(
    defaults.userAccountId ?? ''
  );
  const [editPlayerBio$, setEditPlayerBio$] = useState(defaults.bio ?? '');
  const availability = useAvailability({
    resource: 'players',
    rules: [['nickname'], ['emailAddress']],
    values: { nickname: editPlayerNickname$, emailAddress: editPlayerEmailAddress$ },
    domains: {},
    excludeId: editing?.id ?? null,
  });
  const [editPlayerErrors, setEditPlayerErrors] = useState<FormErrors>({});
  const [editPlayerSeededId, setEditPlayerSeededId] = useState<string | null>(null);
  const editPlayerSeedKey = open ? (editing?.id ?? 'new') : null;
  if (editPlayerSeededId !== editPlayerSeedKey) {
    setEditPlayerSeededId(editPlayerSeedKey);
    if (editPlayerSeedKey !== null) {
      setEditPlayerNickname$(editing ? editing.nickname : (defaults.nickname ?? ''));
      setEditPlayerFullName$(editing ? editing.fullName : (defaults.fullName ?? ''));
      setEditPlayerEmailAddress$(editing ? editing.emailAddress : (defaults.emailAddress ?? ''));
      setEditPlayerJoinedDate$(
        editing
          ? editing.joinedDate
          : (defaults.joinedDate ?? new Date().toISOString().split('T')[0])
      );
      setEditPlayerAvatar$(editing ? editing.avatar : null);
      setEditPlayerUserAccount$(editing ? editing.userAccountId : (defaults.userAccountId ?? ''));
      setEditPlayerBio$(editing ? editing.bio : (defaults.bio ?? ''));
      setEditPlayerErrors({});
    }
  }
  async function submitEditPlayer(): Promise<void> {
    const newErrors: FormErrors = {};
    if (!editPlayerNickname$.trim()) {
      newErrors.nickname = i18n.fill(i18n.chrome.fieldRequired, {
        label: i18n.word('Player.nickname'),
      });
    }
    if (!editPlayerFullName$.trim()) {
      newErrors.fullName = i18n.fill(i18n.chrome.fieldRequired, {
        label: i18n.word('Player.fullName'),
      });
    }
    if (!editPlayerEmailAddress$.trim()) {
      newErrors.emailAddress = i18n.fill(i18n.chrome.fieldRequired, {
        label: i18n.word('Player.emailAddress'),
      });
    }
    if (
      editPlayerEmailAddress$.trim() &&
      !/^[^\s@,;:<>()[\]"\\]+@[^\s@,;:<>()[\]"\\][^\s@,;:<>()[\]"\\.]*\.[^\s@,;:<>()[\]"\\]+$/.test(
        editPlayerEmailAddress$.trim()
      )
    ) {
      newErrors.emailAddress = i18n.chrome.invalidEmail;
    }
    setEditPlayerErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    try {
      const draft = {
        nickname: editPlayerNickname$,
        fullName: editPlayerFullName$,
        emailAddress: editPlayerEmailAddress$,
        joinedDate: editPlayerJoinedDate$,
        avatar: editPlayerAvatar$,
        userAccountId: editPlayerUserAccount$,
        bio: editPlayerBio$,
      };
      if (onSave) {
        await onSave(draft);
      } else if (editing) {
        await updatePlayer({ ...editing, ...draft });
        toast(i18n.chrome.itemSaved);
      } else {
        await createPlayer(draft);
        toast(i18n.fill(i18n.chrome.itemCreated, { name: i18n.word('Player') }));
      }
      if (!onSave) {
        await reloadPlayers();
      }
      if (onSaved) {
        onSaved();
      }
      onClose();
      setEditPlayerErrors({});
    } catch (error) {
      const fieldErrors = refusalFieldErrors(error, [
        'nickname',
        'fullName',
        'emailAddress',
        'joinedDate',
        'avatar',
        'userAccount',
        'bio',
      ]);
      if (fieldErrors === null) {
        throw error;
      }
      setEditPlayerErrors(fieldErrors);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing
              ? i18n.fill(i18n.chrome.editLabel, { name: i18n.word('Player') })
              : i18n.fill(i18n.chrome.newLabel, { name: i18n.word('Player') })}
          </DialogTitle>
          <DialogDescription>
            {i18n.fill(i18n.chrome.editDescription, { name: i18n.word('Player') })}
          </DialogDescription>
        </DialogHeader>
        {editing?._sample && (
          <p role="note" className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
            {i18n.chrome.sampleConversion}
          </p>
        )}
        <form
          ref={focusFirstField}
          className="flex flex-1 flex-col min-h-0"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            submitEvent.stopPropagation();
            runWithToast(submitEditPlayer());
          }}
        >
          <DialogBody>
            <div className="@container flex flex-col gap-6" data-ls="8fe1657654">
              <div className="grid grid-cols-1 gap-6 @md:grid-cols-2">
                <FormField
                  data-ls="833b0774cd"
                  label={i18n.word('Player.nickname')}
                  required
                  error={
                    availability.taken('nickname').includes(editPlayerNickname$)
                      ? i18n.chrome.valueTaken
                      : editPlayerErrors.nickname
                  }
                >
                  <Input
                    type="text"
                    value={editPlayerNickname$}
                    onChange={(e) => {
                      setEditPlayerNickname$(e.target.value);
                    }}
                    disabled={availability.locked('nickname')}
                    onFocus={() => {
                      availability.refresh();
                    }}
                    autoComplete="off"
                  />
                </FormField>
                <FormField
                  data-ls="3f46c2bd82"
                  label={i18n.word('Player.fullName')}
                  required
                  error={editPlayerErrors.fullName}
                >
                  <Input
                    type="text"
                    value={editPlayerFullName$}
                    onChange={(e) => {
                      setEditPlayerFullName$(e.target.value);
                    }}
                    autoComplete="off"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-1 gap-6 @md:grid-cols-2">
                <FormField
                  data-ls="124b71a128"
                  label={i18n.word('Player.emailAddress')}
                  required
                  error={
                    availability.taken('emailAddress').includes(editPlayerEmailAddress$)
                      ? i18n.chrome.valueTaken
                      : editPlayerErrors.emailAddress
                  }
                >
                  <Input
                    type="email"
                    value={editPlayerEmailAddress$}
                    onChange={(e) => {
                      setEditPlayerEmailAddress$(e.target.value);
                    }}
                    disabled={availability.locked('emailAddress')}
                    onFocus={() => {
                      availability.refresh();
                    }}
                    autoComplete="email"
                    placeholder={i18n.chrome.emailPlaceholder}
                  />
                </FormField>
                <FormField
                  data-ls="fc8585c3fb"
                  label={i18n.word('Player.joinedDate')}
                  error={editPlayerErrors.joinedDate}
                >
                  <FormDatePicker
                    value={editPlayerJoinedDate$}
                    onChange={setEditPlayerJoinedDate$}
                  />
                </FormField>
              </div>
              <FormField
                data-ls="44b81543c7"
                label={i18n.word('Player.avatar')}
                error={editPlayerErrors.avatar}
              >
                <FileUpload
                  value={
                    editPlayerAvatar$ !== null && 'data' in editPlayerAvatar$
                      ? editPlayerAvatar$
                      : null
                  }
                  existingFile={
                    editPlayerAvatar$ !== null && 'id' in editPlayerAvatar$
                      ? editPlayerAvatar$
                      : null
                  }
                  existingFileUrl={
                    editPlayerAvatar$ !== null && 'id' in editPlayerAvatar$
                      ? `${apiBaseUrl}/api/files/${editPlayerAvatar$.id}/download?v=${encodeURIComponent(editPlayerAvatar$.fileName)}`
                      : null
                  }
                  onChange={setEditPlayerAvatar$}
                />
              </FormField>
              <FormField
                data-ls="9d1deffbff"
                label={i18n.word('Player.userAccount')}
                error={editPlayerErrors.userAccount}
              >
                <FormUserSelect
                  value={editPlayerUserAccount$}
                  onChange={setEditPlayerUserAccount$}
                />
              </FormField>
              <FormField
                data-ls="88964fb456"
                label={i18n.word('Player.bio')}
                error={editPlayerErrors.bio}
              >
                <FormRichTextEditor value={editPlayerBio$} onChange={setEditPlayerBio$} />
              </FormField>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="rounded-md h-10 px-4 text-sm"
            >
              {i18n.chrome.cancel}
            </Button>
            {canSubmitEditPlayer && (
              <Button
                type="submit"
                data-ls="0dde2b78c9"
                variant="default"
                disabled={isBusy}
                className="rounded-md shadow-sm h-10 px-4 text-sm"
              >
                {isBusy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    {i18n.chrome.savingIndicator}
                  </span>
                ) : editing?._sample ? (
                  i18n.chrome.saveAsNormalRecord
                ) : editing ? (
                  i18n.chrome.saveChanges
                ) : (
                  i18n.fill(i18n.chrome.createItem, { name: i18n.word('Player') })
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
