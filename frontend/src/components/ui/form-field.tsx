import type { JSX } from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { FocusScope } from '@radix-ui/react-focus-scope';
import { ChevronDown, X } from 'lucide-react';
import { Input } from './input';
import { Label } from './label';
import { Switch } from './switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select';
import { cn } from '../../utils/cn';
import { apiBaseUrl } from '../../config/apiConfig';
import { currencySymbol } from '../../config/currency';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  ListNode,
  ListItemNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from '@lexical/list';
import { $getRoot, $createParagraphNode, $createTextNode, FORMAT_TEXT_COMMAND } from 'lexical';
import type { EditorState } from 'lexical';

interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  required,
  optional,
  hint,
  error,
  children,
  className,
  ...rest
}: FormFieldProps): JSX.Element {
  const fieldId = React.useId();
  const fieldRef = React.useRef<HTMLDivElement>(null);
  const previousError = React.useRef(error);
  React.useLayoutEffect(() => {
    const field = fieldRef.current;
    if (field === null) {
      return;
    }
    const labelId = `${fieldId}-label`;
    const descriptionId = `${fieldId}-description`;
    const connect = (): void => {
      const candidates = field.querySelectorAll<HTMLElement>(
        '[data-form-control], input:not([type="hidden"]), textarea, select, [role="textbox"], [role="combobox"], [role="switch"], button'
      );
      const controls = Array.from(candidates).filter(
        (control) =>
          control.closest('[data-form-field]') === field &&
          control.getClientRects().length > 0 &&
          control.getAttribute('aria-hidden') !== 'true'
      );
      const control =
        controls.find((candidate) => candidate.hasAttribute('data-form-control')) ??
        controls.find((candidate) =>
          candidate.matches(
            'input, textarea, select, [role="textbox"], [role="combobox"], [role="switch"]'
          )
        ) ??
        controls.at(0);
      if (control === undefined) {
        return;
      }
      control.id = control.id || fieldId;
      control.setAttribute('data-form-control', '');
      field.querySelector('label')?.setAttribute('for', control.id);
      control.setAttribute('aria-labelledby', labelId);
      control.setAttribute('aria-required', String(required === true));
      control.setAttribute('aria-invalid', String(Boolean(error)));
      if (error || hint) {
        control.setAttribute('aria-describedby', descriptionId);
      } else {
        control.removeAttribute('aria-describedby');
      }
    };
    connect();
    const observer = new MutationObserver(connect);
    observer.observe(field, { childList: true, subtree: true });
    return (): void => {
      observer.disconnect();
    };
  }, [fieldId, required, error, hint]);
  React.useLayoutEffect(() => {
    const field = fieldRef.current;
    if (field === null) {
      return;
    }
    const form = field.closest('form');
    const submitted =
      document.activeElement?.matches('button[type="submit"], input[type="submit"]') === true;
    if (
      error &&
      (error !== previousError.current || submitted) &&
      form?.querySelector('[data-field-error="true"]') === field
    ) {
      const control = field.querySelector<HTMLElement>('[aria-invalid="true"]');
      control?.focus({ preventScroll: true });
      control?.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
    previousError.current = error;
  });
  return (
    <div
      ref={fieldRef}
      data-form-field=""
      data-field-error={Boolean(error)}
      className={cn('space-y-2', className)}
      {...rest}
    >
      <Label id={`${fieldId}-label`} className="flex items-center gap-2 text-foreground">
        <span>{label}</span>
        {required && (
          <span aria-hidden="true" className="text-destructive-text">
            *
          </span>
        )}
        {optional && <span className="text-xs text-muted-foreground font-normal">(optional)</span>}
      </Label>
      {children}
      {hint && !error && (
        <div id={`${fieldId}-description`} className="text-xs text-muted-foreground leading-snug">
          {hint}
        </div>
      )}
      {error && (
        <div id={`${fieldId}-description`} role="alert" className="text-sm text-destructive-text">
          {error}
        </div>
      )}
    </div>
  );
}

type FormInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ className, ...props }, ref) => {
    return <Input ref={ref} className={cn('h-10 text-sm', className)} {...props} />;
  }
);

type MoneyInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, style, ...props }, ref) => {
    const symbol = currencySymbol();
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {symbol}
        </span>
        <Input
          ref={ref}
          className={className}
          style={{ paddingLeft: `calc(1.2rem + ${symbol.length}ch)`, ...style }}
          {...props}
        />
      </div>
    );
  }
);

function parseTags(value: string | string[] | null | undefined): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  const raw = Array.isArray(value) ? value : value.split(',');
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const trimmed = item.trim();
    if (trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}

interface TagsViewProps {
  value: string | string[] | null | undefined;
  className?: string;
}

export function TagsView({ value, className }: TagsViewProps): JSX.Element | null {
  const tags = parseTags(value);
  if (tags.length === 0) {
    return null;
  }
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {tags.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center rounded-full bg-primary/10 text-primary-text px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-primary/20"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

interface FormTagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function FormTagInput({ value, onChange, placeholder }: FormTagInputProps): JSX.Element {
  const [draft, setDraft] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const withTag = (tags: string[], raw: string): string[] => {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || tags.includes(trimmed)) {
      return tags;
    }
    return [...tags, trimmed];
  };
  const commit = (raw: string): void => {
    const next = withTag(value, raw);
    if (next !== value) {
      onChange(next);
    }
  };
  const removeAt = (index: number): void => {
    onChange(value.filter((_, i) => i !== index));
  };
  return (
    <div
      onClick={() => {
        inputRef.current?.focus();
      }}
      className="flex flex-wrap items-center gap-1.5 min-h-10 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background focus-within:border-ring transition-shadow cursor-text"
    >
      {value.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary-text pl-2.5 pr-1 py-0.5 text-xs font-medium ring-1 ring-inset ring-primary/20"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeAt(i);
            }}
            className="rounded-full hover:bg-primary/20 p-0.5 transition-colors"
            aria-label={`Remove ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => {
          const next = e.target.value;
          if (next.includes(',')) {
            const parts = next.split(',');
            let tags = value;
            for (let i = 0; i < parts.length - 1; i++) {
              tags = withTag(tags, parts[i] ?? '');
            }
            if (tags !== value) {
              onChange(tags);
            }
            setDraft(parts[parts.length - 1] ?? '');
            return;
          }
          setDraft(next);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(draft);
            setDraft('');
          } else if (e.key === 'Backspace' && draft.length === 0 && value.length > 0) {
            removeAt(value.length - 1);
          }
        }}
        onBlur={() => {
          if (draft.trim().length > 0) {
            commit(draft);
            setDraft('');
          }
        }}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[8ch] bg-transparent outline-none text-sm placeholder:text-muted-foreground py-0.5"
      />
    </div>
  );
}

interface FormRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

const richTextTheme = {
  text: { bold: 'font-semibold', italic: 'italic', underline: 'underline' },
  list: { ul: 'list-disc pl-5', ol: 'list-decimal pl-5' },
};
const richTextNodes = [ListNode, ListItemNode];

function parseRichText(value: string): { root: unknown } | null {
  if (typeof value !== 'string' || !value.trimStart().startsWith('{')) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && 'root' in parsed ? parsed : null;
  } catch {
    return null;
  }
}
function stripHtml(value: string): string {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, '') : '';
}
function onRichTextError(error: Error): void {
  throw error;
}

function RichTextToolbarButton({
  onClick,
  label,
  title,
  className,
}: {
  onClick: () => void;
  label: string;
  title: string;
  className?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        'inline-flex h-11 min-w-11 items-center justify-center rounded px-2 text-xs text-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
        className
      )}
      title={title}
    >
      {label}
    </button>
  );
}
function RichTextToolbar(): JSX.Element {
  const [editor] = useLexicalComposerContext();
  return (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex items-center gap-0.5 border-b border-input bg-muted px-1.5 py-1"
    >
      <RichTextToolbarButton
        title="Bold"
        label="B"
        className="font-bold"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
      />
      <RichTextToolbarButton
        title="Italic"
        label="I"
        className="italic"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
      />
      <RichTextToolbarButton
        title="Underline"
        label="U"
        className="underline"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
      />
      <div className="mx-1 h-4 w-px bg-border" />
      <RichTextToolbarButton
        title="Bullet list"
        label="•••"
        onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
      />
      <RichTextToolbarButton
        title="Numbered list"
        label="1."
        onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
      />
    </div>
  );
}
function RichTextSyncPlugin({
  value,
  syncedJson,
  onSynced,
}: {
  value: string;
  syncedJson: () => string;
  onSynced: (json: string) => void;
}): null {
  const [editor] = useLexicalComposerContext();
  React.useEffect(() => {
    if (value === syncedJson() || parseRichText(value) === null) {
      return;
    }
    editor.setEditorState(editor.parseEditorState(value));
    onSynced(value);
  }, [value, editor, syncedJson, onSynced]);
  return null;
}
export function FormRichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  ariaLabel,
  className,
}: FormRichTextEditorProps): JSX.Element {
  const [focused, setFocused] = React.useState(false);
  const lastJson = React.useRef(value);
  const readSyncedJson = React.useCallback((): string => lastJson.current, []);
  const markSynced = React.useCallback((json: string): void => {
    lastJson.current = json;
  }, []);
  const initialConfig = {
    namespace: 'form-rich-text',
    nodes: richTextNodes,
    theme: richTextTheme,
    onError: onRichTextError,
    editorState:
      parseRichText(value) !== null
        ? value
        : (): void => {
            const root = $getRoot();
            if (root.getFirstChild() === null) {
              const paragraph = $createParagraphNode();
              const text = stripHtml(value);
              if (text.length > 0) {
                paragraph.append($createTextNode(text));
              }
              root.append(paragraph);
            }
          },
  };
  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className={cn(
          'rounded-md border border-input overflow-hidden',
          focused && 'ring-2 ring-ring ring-offset-1',
          className
        )}
      >
        <RichTextToolbar />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                ariaLabel={ariaLabel}
                onFocus={() => {
                  setFocused(true);
                }}
                onBlur={() => {
                  setFocused(false);
                  onBlur?.(lastJson.current);
                }}
                className="min-h-[120px] p-3 text-sm text-foreground outline-none prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              />
            }
            placeholder={
              <div className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">
                {placeholder ?? ''}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <OnChangePlugin
          onChange={(editorState: EditorState) => {
            const json = JSON.stringify(editorState.toJSON());
            lastJson.current = json;
            onChange(json);
          }}
        />
        <RichTextSyncPlugin value={value} syncedJson={readSyncedJson} onSynced={markSynced} />
      </div>
    </LexicalComposer>
  );
}

interface RichTextDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function RichTextDisplay({ value, className, ...rest }: RichTextDisplayProps): JSX.Element {
  const displayClass = cn(
    'text-sm text-foreground leading-relaxed prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
    className
  );
  if (parseRichText(value) === null) {
    return (
      <div className={displayClass} {...rest}>
        {stripHtml(value)}
      </div>
    );
  }
  const initialConfig = {
    namespace: 'rich-text-display',
    nodes: richTextNodes,
    theme: richTextTheme,
    editable: false,
    editorState: value,
    onError: onRichTextError,
  };
  return (
    <div {...rest}>
      <LexicalComposer initialConfig={initialConfig}>
        <RichTextPlugin
          contentEditable={<ContentEditable className={displayClass} />}
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
      </LexicalComposer>
    </div>
  );
}

interface FormSelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FormSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  unavailable?: string[];
  currentValue?: string;
  onOpen?: () => void;
  onCreateNew?: () => void;
  createNewLabel?: string;
}

const CREATE_NEW_VALUE = '__create_new__';

export function FormSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  unavailable = [],
  currentValue,
  onOpen,
  onCreateNew,
  createNewLabel = 'Create new...',
}: FormSelectProps): JSX.Element {
  function handleChange(selected: string): void {
    if (selected === CREATE_NEW_VALUE) {
      onCreateNew?.();
      return;
    }
    if (!options.some((option) => option.value === selected)) {
      return;
    }
    onChange(selected);
  }

  return (
    <Select
      value={value}
      onValueChange={handleChange}
      onOpenChange={(open) => {
        if (open) {
          onOpen?.();
        }
      }}
    >
      <SelectTrigger className="h-10" disabled={disabled}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={unavailable.includes(option.value)}
          >
            {option.label}
            {option.value === currentValue && (
              <span className="ml-2 text-xs text-muted-foreground">current</span>
            )}
          </SelectItem>
        ))}
        {onCreateNew && (
          <>
            {options.length > 0 && <SelectSeparator />}
            <SelectItem value={CREATE_NEW_VALUE}>{createNewLabel}</SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}

interface FormMultiSelectOption {
  value: string;
  label: string;
}

interface FormMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: FormMultiSelectOption[];
}

export function FormMultiSelect({ value, onChange, options }: FormMultiSelectProps): JSX.Element {
  const selected = value;
  function toggle(optionValue: string): void {
    if (selected.includes(optionValue)) {
      onChange(selected.filter((entry) => entry !== optionValue));
    } else {
      onChange([...selected, optionValue]);
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              toggle(option.value);
            }}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'border-accent bg-accent/10 text-foreground ring-2 ring-accent'
                : 'border-border bg-card text-muted-foreground hover:border-accent/50'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface FormComboboxOption {
  value: string;
  label: string;
}

interface FormComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: FormComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  unavailable?: string[];
  currentValue?: string;
  onOpen?: () => void;
}

export function FormCombobox({
  value,
  onChange,
  options,
  placeholder = 'Select or type...',
  disabled = false,
  unavailable = [],
  currentValue,
  onOpen,
}: FormComboboxProps): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<string | null>(null);
  const inputValue = draft ?? options.find((o) => o.value === value)?.label ?? value;
  const [dirty, setDirty] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLUListElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({});

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      const target = event.target as Node;
      const insideContainer = containerRef.current?.contains(target) ?? false;
      const insideDropdown = dropdownRef.current?.contains(target) ?? false;
      if (insideContainer || insideDropdown) {
        return;
      }
      setOpen(false);
      setDirty(false);
      setDraft(null);
      const matched = options.find((o) => o.label.toLowerCase() === inputValue.toLowerCase());
      const next = matched ? matched.value : inputValue;
      if (!unavailable.includes(next)) {
        onChange(next);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return (): void => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [inputValue, onChange, options, unavailable]);

  function updateDropdownPosition(): void {
    if (!inputRef.current) {
      return;
    }
    const rect = inputRef.current.getBoundingClientRect();
    const preferredHeight = 220;
    const margin = 8;
    const below = window.innerHeight - rect.bottom - margin;
    const above = rect.top - margin;
    const openUp = below < preferredHeight && above > below;
    const maxHeight = Math.min(preferredHeight, openUp ? above : below);
    setDropdownStyle({
      position: 'fixed',
      top: openUp ? undefined : rect.bottom + 4,
      bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
      left: rect.left,
      width: rect.width,
      maxHeight,
      zIndex: 9999,
    });
  }

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (): void => {
      updateDropdownPosition();
    };
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return (): void => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [open]);

  const filtered = dirty
    ? options.filter((o) => o.label.toLowerCase().includes(inputValue.toLowerCase()))
    : options;

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => {
          onOpen?.();
          setDirty(false);
          updateDropdownPosition();
          setOpen(true);
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(true);
          updateDropdownPosition();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const matched = options.find((o) => o.label.toLowerCase() === inputValue.toLowerCase());
            const next = matched ? matched.value : inputValue;
            if (!unavailable.includes(next)) {
              onChange(next);
            }
            setDirty(false);
            setDraft(null);
            setOpen(false);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="h-10 w-full rounded-lg border border-border bg-transparent pl-4 pr-9 text-sm text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {open &&
        filtered.length > 0 &&
        ReactDOM.createPortal(
          <FocusScope
            asChild
            onMountAutoFocus={(e) => {
              e.preventDefault();
            }}
            onUnmountAutoFocus={(e) => {
              e.preventDefault();
            }}
          >
            <ul
              ref={dropdownRef}
              style={dropdownStyle}
              className="pointer-events-auto overflow-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
            >
              {filtered.map((option) => {
                const optionUnavailable = unavailable.includes(option.value);
                return (
                  <li
                    key={option.value}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (optionUnavailable) {
                        return;
                      }
                      onChange(option.value);
                      setDraft(null);
                      setDirty(false);
                      setOpen(false);
                    }}
                    className={cn(
                      'px-4 py-2 text-sm',
                      optionUnavailable
                        ? 'cursor-not-allowed text-muted-foreground opacity-50'
                        : 'cursor-pointer text-foreground hover:bg-accent hover:text-accent-foreground',
                      option.value === value && 'bg-accent/50 font-medium'
                    )}
                  >
                    {option.label}
                    {option.value === currentValue && (
                      <span className="ml-2 text-xs text-muted-foreground">current</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </FocusScope>,
          document.body
        )}
    </div>
  );
}

interface FormSwitchProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function FormSwitch({ value, onChange }: FormSwitchProps): JSX.Element {
  return <Switch checked={value} onCheckedChange={onChange} />;
}

interface FormDateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function FormDateTimePicker({ value, onChange }: FormDateTimePickerProps): JSX.Element {
  function toLocalInputValue(iso: string): string {
    if (!iso) {
      return '';
    }
    const date = new Date(iso);
    if (isNaN(date.getTime())) {
      return '';
    }
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function handleChange(localValue: string): void {
    if (!localValue) {
      onChange('');
      return;
    }
    onChange(new Date(localValue).toISOString());
  }

  return (
    <input
      type="datetime-local"
      value={toLocalInputValue(value)}
      onChange={(e) => {
        handleChange(e.target.value);
      }}
      className="h-10 w-full rounded-lg border border-border bg-background px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
    />
  );
}

interface FormDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  unavailable?: string[];
  onOpen?: () => void;
}

export function FormDatePicker({
  value,
  onChange,
  disabled = false,
  unavailable = [],
  onOpen,
}: FormDatePickerProps): JSX.Element {
  return (
    <div>
      <input
        type="date"
        value={value}
        disabled={disabled}
        onFocus={() => {
          onOpen?.();
        }}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="h-10 w-full rounded-lg border border-border bg-transparent px-4 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
      />
      {value !== '' && unavailable.includes(value) && (
        <p className="mt-1 text-xs text-destructive">Fully booked</p>
      )}
    </div>
  );
}

interface FormUserMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

interface UserEntry {
  id: string;
  label: string;
}

export function FormUserMultiSelect({
  value,
  onChange,
  placeholder = 'Search users…',
}: FormUserMultiSelectProps): JSX.Element {
  const [users, setUsers] = React.useState<UserEntry[]>([]);
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    fetch(`${apiBaseUrl}/api/users`, { credentials: 'include' })
      .then(
        (r) => r.json() as Promise<{ users: Array<{ id: string; name: string; email: string }> }>
      )
      .then((data) => {
        setUsers(data.users.map((u) => ({ id: u.id, label: u.name || u.email })));
      })
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return (): void => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const available = users.filter(
    (u) => !value.includes(u.id) && (!query || u.label.toLowerCase().includes(query.toLowerCase()))
  );

  function handleOpen(): void {
    setQuery('');
    setOpen(true);
  }

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      <div
        data-form-control=""
        role="button"
        tabIndex={0}
        aria-expanded={open}
        className="min-h-10 rounded-lg border border-border bg-transparent px-3 py-1.5 flex flex-wrap gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onKeyDown={(event) => {
          if (
            event.target === event.currentTarget &&
            (event.key === 'Enter' || event.key === ' ')
          ) {
            event.preventDefault();
            handleOpen();
          }
        }}
        onClick={handleOpen}
      >
        {value.map((id) => {
          const user = users.find((u) => u.id === id);
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent/15 text-accent-text text-xs font-medium"
            >
              {user?.label ?? 'Unknown user'}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((v) => v !== id));
                }}
                className="hover:text-destructive-text transition-colors leading-none text-base"
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          );
        })}
        {!open && value.length === 0 && (
          <span className="flex-1 text-sm text-muted-foreground py-0.5">{placeholder}</span>
        )}
        {open && (
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder="Search…"
            className="flex-1 min-w-[8rem] bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
        )}
      </div>
      {open && (
        <ul className="absolute z-50 w-full max-h-40 overflow-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          {available.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No users found</li>
          ) : (
            available.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent/10 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    onChange([...value, u.id]);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  {u.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

interface FormUserSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function FormUserSelect({
  value,
  onChange,
  placeholder = 'Select user…',
}: FormUserSelectProps): JSX.Element {
  const [users, setUsers] = React.useState<UserEntry[]>([]);
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    fetch(`${apiBaseUrl}/api/users`, { credentials: 'include' })
      .then(
        (r) => r.json() as Promise<{ users: Array<{ id: string; name: string; email: string }> }>
      )
      .then((data) => {
        setUsers(data.users.map((u) => ({ id: u.id, label: u.name || u.email })));
      })
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return (): void => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selected = users.find((u) => u.id === value);
  const available = users.filter(
    (u) => !query || u.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      <div
        data-form-control=""
        role="button"
        tabIndex={0}
        aria-expanded={open}
        className="min-h-10 rounded-lg border border-border bg-transparent px-3 py-1.5 flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onKeyDown={(event) => {
          if (
            event.target === event.currentTarget &&
            (event.key === 'Enter' || event.key === ' ')
          ) {
            event.preventDefault();
            setQuery('');
            setOpen(true);
          }
        }}
        onClick={() => {
          setQuery('');
          setOpen(true);
        }}
      >
        {!open && (
          <span
            className={
              selected
                ? 'flex-1 text-sm text-foreground py-0.5'
                : 'flex-1 text-sm text-muted-foreground py-0.5'
            }
          >
            {selected ? selected.label : placeholder}
          </span>
        )}
        {open && (
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder="Search…"
            className="flex-1 min-w-[8rem] bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
        )}
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="hover:text-destructive-text transition-colors leading-none text-base"
            aria-label="Remove"
          >
            ×
          </button>
        )}
      </div>
      {open && (
        <ul className="absolute z-50 w-full max-h-40 overflow-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          {available.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No users found</li>
          ) : (
            available.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent/10 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    onChange(u.id);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  {u.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
