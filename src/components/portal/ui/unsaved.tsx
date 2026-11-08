'use client';

import Link from 'next/link';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from 'react';

/*
 * Guards unsaved edits. A view calls useUnsavedChanges(dirty): closing or reloading the tab
 * asks first (beforeunload), and so do the portal's own links (tabs, shell navigation,
 * breadcrumbs, TextLink and ButtonLink), which navigate inside the app and would otherwise
 * discard the edits silently. Every ActionForm (so every FormDialog) registers itself through
 * useFormEdits; views that compare against saved values opt out and register their own.
 */

interface UnsavedContextValue {
  setDirty: (id: string, dirty: boolean) => void;
  // Call from a link's onNavigate; returns false when the person chose to stay
  confirmLeave: () => boolean;
}

const UnsavedContext = createContext<UnsavedContextValue>({ setDirty: () => {}, confirmLeave: () => true });

const LEAVE_MESSAGE = 'You have unsaved changes. Leave this page without saving them?';

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const dirtyViews = useRef(new Set<string>());

  const setDirty = useCallback((id: string, dirty: boolean) => {
    if (dirty) dirtyViews.current.add(id);
    else dirtyViews.current.delete(id);
  }, []);

  const confirmLeave = useCallback(() => {
    if (dirtyViews.current.size === 0) return true;
    const leave = window.confirm(LEAVE_MESSAGE);
    // The views unmount on navigation; forget them so a later link does not ask again
    if (leave) dirtyViews.current.clear();
    return leave;
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyViews.current.size === 0) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const value = useMemo(() => ({ setDirty, confirmLeave }), [setDirty, confirmLeave]);
  return <UnsavedContext.Provider value={value}>{children}</UnsavedContext.Provider>;
}

// Register a view's unsaved state; cleared automatically when the view unmounts
export function useUnsavedChanges(dirty: boolean) {
  const { setDirty } = useContext(UnsavedContext);
  const id = useId();
  useEffect(() => {
    setDirty(id, dirty);
    return () => setDirty(id, false);
  }, [id, dirty, setDirty]);
}

/*
 * Whether anything has been typed, chosen or attached in a form since it mounted or was last
 * cleared (ActionForm clears it on success). Ticking a checkbox or radio on its own is not
 * counted: it is one click to redo, and a toggle such as "Internal note" is not unsaved work.
 * After a failed submit the form still holds what was typed, so it stays edited.
 */
export function useFormEdits(formRef: RefObject<HTMLFormElement | null>) {
  const [edited, setEdited] = useState(false);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const onEdit = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (!target || target.type === 'hidden' || target.type === 'checkbox' || target.type === 'radio') return;
      setEdited(true);
    };
    form.addEventListener('input', onEdit);
    form.addEventListener('change', onEdit);
    return () => {
      form.removeEventListener('input', onEdit);
      form.removeEventListener('change', onEdit);
    };
  }, [formRef]);
  return [edited, setEdited] as const;
}

// For Next <Link onNavigate>: cancels the navigation when the person chooses to stay
export function useLeaveGuard() {
  const { confirmLeave } = useContext(UnsavedContext);
  return useCallback(
    (event: { preventDefault: () => void }) => {
      if (!confirmLeave()) event.preventDefault();
    },
    [confirmLeave],
  );
}

// next/link that asks before leaving unsaved edits; style it with styled(GuardedLink)
export const GuardedLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof Link>>(function GuardedLink(
  { onNavigate, ...props },
  ref,
) {
  const guard = useLeaveGuard();
  return (
    <Link
      ref={ref}
      {...props}
      onNavigate={(event) => {
        guard(event);
        onNavigate?.(event);
      }}
    />
  );
});
