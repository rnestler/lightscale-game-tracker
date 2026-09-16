import type { JSX } from 'react';
import { useState } from 'react';
import type * as $Domain from '../types/domain';
import { usePermissions, canUpdateField, canCreateField } from '../hooks/usePermissions';
import { usePlayers } from '../hooks/usePlayers';
import { toast } from '../utils/toast';

import { getErrorMessage, refusalFieldErrors, runWithToast } from '../utils/errorHandling';
import { textValue } from '../utils/recordValues';
import { Button } from './ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { FormField, FormUserSelect, FormDatePicker, FormRichTextEditor } from './ui/form-field';
import { FileUpload } from './ui/file-upload';
import { apiBaseUrl } from '../config/apiConfig';
import type { FileUploadValue, FileValue } from '../types/file';
import { useAvailability } from '../hooks/useAvailability';
import { ErrorMessage } from './ui/error-message';
import { Loader2Icon } from 'lucide-react';

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

type FormErrors = Partial<Record<string, string>>;

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
  const playersHook = usePlayers({ autoLoad: false });
  const [nickname$, setNickname$] = useState('');
  const [fullName$, setFullName$] = useState('');
  const [emailAddress$, setEmailAddress$] = useState('');
  const [joinedDate$, setJoinedDate$] = useState(new Date().toISOString().split('T')[0]);
  const [avatar$, setAvatar$] = useState<FileUploadValue | FileValue | null>(null);
  const [userAccount$, setUserAccount$] = useState('');
  const [bio$, setBio$] = useState('');
  const availability = useAvailability({
    resource: 'players',
    rules: [['nickname'], ['emailAddress']],
    values: { nickname: nickname$, emailAddress: emailAddress$ },
    domains: {},
    excludeId: editing !== null ? editing.id : null,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [rootError, setRootError] = useState<string | null>(null);
  const [seededKey, setSeededKey] = useState<string | null>(null);
  const seedKey = open ? (editing?.id ?? 'new') : null;
  if (seededKey !== seedKey) {
    setSeededKey(seedKey);
    if (seedKey !== null && editing) {
      setNickname$(textValue(editing.nickname));
      setFullName$(textValue(editing.fullName));
      setEmailAddress$(textValue(editing.emailAddress));
      setJoinedDate$(textValue(editing.joinedDate));
      setAvatar$(editing.avatar ?? null);
      setUserAccount$(textValue(editing.userAccountId));
      setBio$(textValue(editing.bio));
      setErrors({});
      setRootError(null);
    } else if (seedKey !== null) {
      setNickname$(defaults.nickname ?? '');
      setFullName$(defaults.fullName ?? '');
      setEmailAddress$(defaults.emailAddress ?? '');
      setJoinedDate$(defaults.joinedDate ?? new Date().toISOString().split('T')[0]);
      setAvatar$(null);
      setUserAccount$(defaults.userAccountId ?? '');
      setBio$(defaults.bio ?? '');
      setErrors({});
      setRootError(null);
    }
  }
  async function submit(): Promise<void> {
    const newErrors: FormErrors = {};
    if (!nickname$.trim()) {
      newErrors.nickname = 'Nickname / Handle is required.';
    }
    if (!fullName$.trim()) {
      newErrors.fullName = 'Full Name is required.';
    }
    if (!emailAddress$.trim()) {
      newErrors.emailAddress = 'Email Address is required.';
    }
    if (emailAddress$.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress$.trim())) {
      newErrors.emailAddress = 'Enter a valid email address.';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    const data = {
      nickname: nickname$,
      fullName: fullName$,
      emailAddress: emailAddress$,
      joinedDate: joinedDate$,
      avatar: avatar$,
      userAccountId: userAccount$,
      bio: bio$,
    };
    try {
      if (onSave) {
        await onSave(data);
      } else {
        if (editing) {
          await playersHook.updatePlayer({ id: editing.id, ...data });
        } else {
          await playersHook.createPlayer(data);
        }
        toast(editing !== null ? 'Changes saved.' : 'Player created.');
        await playersHook.reloadPlayers();
      }
      if (onSaved) {
        onSaved();
      }
      onClose();
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
        setRootError(getErrorMessage(error, 'Save failed'));
      } else {
        setErrors(fieldErrors);
      }
    }
  }
  const selectedLabel = editing ? 'Edit player' : 'New player';
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{selectedLabel}</DialogTitle>
          <DialogDescription>
            Fill in the player details below. Required fields are marked with an asterisk.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            runWithToast(submit());
          }}
        >
          <DialogBody>
            <div data-ls="8fe1657654" className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2 sm:items-start">
                {(editing ? canUpdateField : canCreateField)(
                  permissions,
                  'players',
                  'nickname'
                ) && (
                  <FormField
                    data-ls="833b0774cd"
                    label="Nickname / Handle"
                    required
                    error={
                      availability.taken('nickname').includes(nickname$)
                        ? 'Already in use'
                        : errors.nickname
                    }
                  >
                    <Input
                      type="text"
                      value={nickname$}
                      onChange={(e) => {
                        setNickname$(e.target.value);
                      }}
                      disabled={availability.locked('nickname')}
                      onFocus={() => {
                        availability.refresh();
                      }}
                      autoComplete="off"
                    />
                  </FormField>
                )}
                {(editing ? canUpdateField : canCreateField)(
                  permissions,
                  'players',
                  'fullName'
                ) && (
                  <FormField
                    data-ls="3f46c2bd82"
                    label="Full Name"
                    required
                    error={errors.fullName}
                  >
                    <Input
                      type="text"
                      value={fullName$}
                      onChange={(e) => {
                        setFullName$(e.target.value);
                      }}
                      autoComplete="off"
                    />
                  </FormField>
                )}
              </div>
              <div className="grid gap-6 sm:grid-cols-2 sm:items-start">
                {(editing ? canUpdateField : canCreateField)(
                  permissions,
                  'players',
                  'emailAddress'
                ) && (
                  <FormField
                    data-ls="124b71a128"
                    label="Email Address"
                    required
                    error={
                      availability.taken('emailAddress').includes(emailAddress$)
                        ? 'Already in use'
                        : errors.emailAddress
                    }
                  >
                    <Input
                      type="email"
                      value={emailAddress$}
                      onChange={(e) => {
                        setEmailAddress$(e.target.value);
                      }}
                      disabled={availability.locked('emailAddress')}
                      onFocus={() => {
                        availability.refresh();
                      }}
                      autoComplete="email"
                      placeholder="name@example.com"
                    />
                  </FormField>
                )}
                {(editing ? canUpdateField : canCreateField)(
                  permissions,
                  'players',
                  'joinedDate'
                ) && (
                  <FormField data-ls="fc8585c3fb" label="Member Since" error={errors.joinedDate}>
                    <FormDatePicker value={joinedDate$} onChange={setJoinedDate$} />
                  </FormField>
                )}
              </div>
              {(editing ? canUpdateField : canCreateField)(permissions, 'players', 'avatar') && (
                <FormField data-ls="44b81543c7" label="Avatar" error={errors.avatar}>
                  <FileUpload
                    value={avatar$ !== null && 'data' in avatar$ ? avatar$ : null}
                    existingFile={avatar$ !== null && 'id' in avatar$ ? avatar$ : null}
                    existingFileUrl={
                      avatar$ !== null && 'id' in avatar$
                        ? `${apiBaseUrl}/api/files/${avatar$.id}/download?v=${encodeURIComponent(avatar$.fileName)}`
                        : null
                    }
                    onChange={setAvatar$}
                  />
                </FormField>
              )}
              {(editing ? canUpdateField : canCreateField)(
                permissions,
                'players',
                'userAccountId'
              ) && (
                <FormField data-ls="9d1deffbff" label="Linked User" error={errors.userAccount}>
                  <FormUserSelect value={userAccount$} onChange={setUserAccount$} />
                </FormField>
              )}
              {(editing ? canUpdateField : canCreateField)(permissions, 'players', 'bio') && (
                <FormField data-ls="88964fb456" label="Player Bio" error={errors.bio}>
                  <FormRichTextEditor value={bio$} onChange={setBio$} />
                </FormField>
              )}
              {rootError !== null && <ErrorMessage message={rootError} />}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="rounded-md h-10 px-4 text-sm"
            >
              Cancel
            </Button>
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
                  {'Saving...'}
                </span>
              ) : editing ? (
                'Save changes'
              ) : (
                'Create player'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
