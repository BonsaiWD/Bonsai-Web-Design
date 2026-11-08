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
 * breadcrumbs, TextLink and ButtonLink), the browser's Back and Forward inside the app, and
 * the shell's View as client and Sign out (useConfirmLeave). All of these navigate inside the
 * app and would otherwise discard the edits silently. Every ActionForm (so every FormDialog)
 * registers itself through useFormEdits; views that compare against saved values opt out and
 * register their own.
 */

interface UnsavedContextValue {
  setDirty: (id: string, dirty: boolean) => void;
  // Call from a link's onNavigate; returns false when the person chose to stay
  confirmLeave: () => boolean;
}

const UnsavedContext = createContext<UnsavedContextValue>({ setDirty: () => {}, confirmLeave: () => true });

const LEAVE_MESSAGE = 'You have unsaved changes. Leave this page without saving them?';

// The parts of the Navigation API the guard uses (not in every TypeScript DOM lib yet)
interface NavigationLike extends EventTarget {
  currentEntry: { key: string } | null;
  traverseTo: (key: string) => unknown;
}

interface NavigateEventLike extends Event {
  navigationType: 'push' | 'replace' | 'reload' | 'traverse';
  destination: { sameDocument: boolean };
}

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

  /*
   * Back and Forward between portal pages stay in the document: Next renders the other page on
   * popstate, so beforeunload never runs. The Navigation API lets the traversal be cancelled
   * before it happens. When the browser will not allow that (a second Back with no click or
   * key press in between) or has no Navigation API, the question is asked on popstate instead,
   * ahead of Next's own listener (capture runs first), and staying returns to the edited page.
   */
  useEffect(() => {
    const navigation = (window as Window & { navigation?: NavigationLike }).navigation;
    let askOnPopState = !navigation;
    let returnTo: string | null = null;
    let restoring = false;

    const onNavigate = (event: Event) => {
      const traverse = event as NavigateEventLike;
      if (traverse.navigationType !== 'traverse' || restoring || dirtyViews.current.size === 0) return;
      // Another document (the page before the portal): beforeunload asks
      if (!traverse.destination.sameDocument) return;
      if (traverse.cancelable) {
        if (!confirmLeave()) traverse.preventDefault();
        return;
      }
      askOnPopState = true;
      returnTo = navigation?.currentEntry?.key ?? null;
    };

    const onPopState = (event: PopStateEvent) => {
      if (restoring) {
        // The way back to the edited page, which Next never left
        restoring = false;
        event.stopImmediatePropagation();
        return;
      }
      if (!askOnPopState) return;
      askOnPopState = !navigation;
      if (dirtyViews.current.size === 0 || confirmLeave()) return;
      event.stopImmediatePropagation();
      restoring = true;
      if (navigation && returnTo) navigation.traverseTo(returnTo);
      else window.history.go(1);
    };

    navigation?.addEventListener('navigate', onNavigate);
    window.addEventListener('popstate', onPopState, true);
    return () => {
      navigation?.removeEventListener('navigate', onNavigate);
      window.removeEventListener('popstate', onPopState, true);
    };
  }, [confirmLeave]);

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

// Whether a form's text fields, selects or file inputs differ from what they started with.
// Checkboxes and radios are left out: one click to redo, and a toggle such as "Internal note"
// is not unsaved work.
function formHasEdits(form: HTMLFormElement) {
  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLTextAreaElement) {
      if (element.value !== element.defaultValue) return true;
    } else if (element instanceof HTMLSelectElement) {
      const options = Array.from(element.options);
      if (element.multiple) {
        if (options.some((option) => option.selected !== option.defaultSelected)) return true;
      } else {
        // With no option marked, a select starts on its first enabled option
        const initial = options.find((option) => option.defaultSelected) ?? options.find((option) => !option.disabled);
        if (initial && element.value !== initial.value) return true;
      }
    } else if (element instanceof HTMLInputElement) {
      if (['hidden', 'checkbox', 'radio', 'submit', 'button', 'reset', 'image'].includes(element.type)) continue;
      if (element.type === 'file' ? Boolean(element.files?.length) : element.value !== element.defaultValue) return true;
    }
  }
  return false;
}

/*
 * Whether anything typed, chosen or attached in a form is still there: checked again on every
 * edit, so removing what was typed clears it. ActionForm clears it on success, and keeps a
 * form guarded after a failed submit, whose fields then start from what was sent.
 */
export function useFormEdits(formRef: RefObject<HTMLFormElement | null>) {
  const [edited, setEdited] = useState(false);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const onEdit = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (!target || target.type === 'hidden' || target.type === 'checkbox' || target.type === 'radio') return;
      setEdited(formHasEdits(form));
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

// Asks before something other than a link leaves the page (signing out, switching views);
// false when the person chose to stay
export function useConfirmLeave() {
  return useContext(UnsavedContext).confirmLeave;
}

// For Next <Link onNavigate> and a form's onSubmit: cancels when the person chooses to stay
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
