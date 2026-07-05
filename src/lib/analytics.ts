/**
 * Google Analytics helpers.
 *
 * Do not send note content, passwords, password hashes, or raw request bodies.
 */

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const VISITOR_ID_KEY = 'kloud_visitor_id';
const TAB_ID_KEY = 'kloud_tab_id';

export type ActorRelation =
  | 'same_tab'
  | 'same_browser_other_tab'
  | 'other_browser_or_device'
  | 'unknown';

export type AnalyticsEventName =
  | 'ghost_note_viewed'
  | 'existing_note_viewed'
  | 'locked_note_viewed'
  | 'unlocked_note_viewed'
  | 'note_viewed_by_creator_browser'
  | 'note_viewed_by_other_browser_or_device'
  | 'note_viewed_by_unknown_browser'
  | 'note_created_by_autosave'
  | 'note_created_by_manual_save'
  | 'note_edited_by_autosave'
  | 'note_edited_by_manual_save'
  | 'note_renamed'
  | 'note_link_copied'
  | 'recent_note_opened'
  | 'new_note_started'
  | 'password_prompt_shown'
  | 'password_unlock_succeeded'
  | 'password_unlock_failed'
  | 'password_added_to_note'
  | 'password_removed_from_note'
  | 'password_changed'
  | 'custom_link_edit_started'
  | 'custom_link_available'
  | 'custom_link_taken'
  | 'custom_link_invalid'
  | 'custom_link_check_rate_limited'
  | 'custom_link_check_failed'
  | 'note_updated_in_same_browser_other_tab'
  | 'note_updated_in_other_browser_or_device'
  | 'note_updated_by_unknown_browser'
  | 'note_remote_update_reload_clicked'
  | 'autosave_rate_limited'
  | 'manual_save_rate_limited'
  | 'note_create_failed'
  | 'note_update_failed'
  | 'password_unlock_rate_limited'
  | 'password_unlock_request_failed'
  | 'theme_changed_to_light'
  | 'theme_changed_to_dark';

export type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function createAnalyticsId(prefix: string) {
  const randomValue =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return `${prefix}_${randomValue.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export function getOrCreateVisitorId() {
  if (!canUseBrowserStorage()) {
    return createAnalyticsId('visitor');
  }

  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;

    const nextId = createAnalyticsId('visitor');
    localStorage.setItem(VISITOR_ID_KEY, nextId);
    return nextId;
  } catch {
    return createAnalyticsId('visitor');
  }
}

export function getOrCreateTabId() {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return createAnalyticsId('tab');
  }

  try {
    const existing = sessionStorage.getItem(TAB_ID_KEY);
    if (existing) return existing;

    const nextId = createAnalyticsId('tab');
    sessionStorage.setItem(TAB_ID_KEY, nextId);
    return nextId;
  } catch {
    return createAnalyticsId('tab');
  }
}

export function getContentLengthBucket(contentLength: number) {
  if (contentLength <= 100) return '1_100';
  if (contentLength <= 500) return '101_500';
  if (contentLength <= 2000) return '501_2000';
  return '2001_10000';
}

function ensureGtag() {
  if (typeof window === 'undefined') {
    return false;
  }

  window.dataLayer = window.dataLayer || [];

  if (typeof window.gtag !== 'function') {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer?.push(args);
    };
  }

  return true;
}

export function trackEvent(eventName: AnalyticsEventName, params: AnalyticsParams = {}) {
  if (!GA_MEASUREMENT_ID || !ensureGtag()) {
    return;
  }

  const cleanedParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
  );

  window.gtag?.('event', eventName, cleanedParams);
}

export function trackPageView(path: string, title?: string) {
  if (!GA_MEASUREMENT_ID || !ensureGtag()) {
    return;
  }

  window.gtag?.('config', GA_MEASUREMENT_ID, {
    page_path: path,
    page_title: title ?? document.title,
  });
}
