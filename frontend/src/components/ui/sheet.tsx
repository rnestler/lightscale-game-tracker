import { i18n } from '../../i18n/text';
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

export const Sheet = DialogPrimitive.Root;

export type SheetVariant = 'drawer' | 'modal' | 'page';

const SHEET_OVERLAY_VARIANTS: Record<SheetVariant, string> = {
  drawer: 'ui-overlay-backdrop-soft',
  modal: 'ui-overlay-backdrop',
  page: 'ui-overlay-backdrop',
};

const SHEET_PANEL_VARIANTS: Record<SheetVariant, string> = {
  drawer:
    'ui-sheet-panel fixed inset-y-0 right-0 h-full w-full max-w-2xl border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right print:static print:inset-auto print:max-w-none print:h-auto print:shadow-none print:border-none',
  modal:
    'ui-dialog-panel fixed inset-x-0 bottom-0 w-full max-h-[92dvh] overflow-hidden border pb-[env(safe-area-inset-bottom)] md:inset-x-auto md:bottom-auto md:left-[50%] md:top-[50%] md:max-w-2xl md:max-h-[90vh] md:translate-x-[-50%] md:translate-y-[-50%] md:pb-0 lg:max-w-4xl xl:max-w-5xl data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
  page: 'fixed inset-0 h-full w-full',
};

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { variant?: SheetVariant }
>(({ className, children, variant = 'drawer', ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 print:hidden',
        SHEET_OVERLAY_VARIANTS[variant]
      )}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        '@container z-50 flex flex-col gap-0 border-border bg-card text-card-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        SHEET_PANEL_VARIANTS[variant],
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="ui-control-ghost absolute right-4 top-4 rounded-md p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 print:hidden">
        <X className="h-4 w-4" />
        <span className="sr-only">{i18n.chrome.close}</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
