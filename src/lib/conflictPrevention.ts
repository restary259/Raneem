/**
 * Conflict prevention utilities for multi-device safety.
 * - Optimistic locking via updated_at comparison
 * - Idempotency key generation
 * - Atomic update helper
 */
import { supabase } from '@/integrations/supabase/client';

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------
const IDEMPOTENCY_STORE_KEY = 'darb_idempotency_keys';
const MAX_STORED_KEYS = 200;

/**
 * Generate a unique idempotency key for an action.
 * Prevents double-clicks from creating duplicate server-side effects.
 */
export function generateIdempotencyKey(action: string, targetId: string): string {
  return `${action}:${targetId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Check if an idempotency key was already used. If not, mark it as used.
 * Returns true if the action should proceed (first time), false if duplicate.
 */
export function claimIdempotencyKey(key: string): boolean {
  try {
    const stored = JSON.parse(localStorage.getItem(IDEMPOTENCY_STORE_KEY) || '[]') as string[];
    if (stored.includes(key)) return false;
    stored.push(key);
    // Keep only recent keys
    if (stored.length > MAX_STORED_KEYS) stored.splice(0, stored.length - MAX_STORED_KEYS);
    localStorage.setItem(IDEMPOTENCY_STORE_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return true; // On error, allow action
  }
}

// ---------------------------------------------------------------------------
// Optimistic Locking
// ---------------------------------------------------------------------------

export interface OptimisticUpdateOptions {
  table: string;
  id: string;
  updates: Record<string, any>;
  expectedUpdatedAt: string; // The updated_at value the client last saw
}

export interface OptimisticUpdateResult {
  success: boolean;
  conflict: boolean;
  error?: string;
  data?: any;
}

/**
 * Perform an atomic update with optimistic locking.
 * Only succeeds if the record's updated_at matches what the client expects.
 * If another device changed the record, returns conflict: true.
 */
export async function atomicUpdate({
  table,
  id,
  updates,
  expectedUpdatedAt,
}: OptimisticUpdateOptions): Promise<OptimisticUpdateResult> {
  try {
    const { data, error, count } = await (supabase as any)
      .from(table)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('updated_at', expectedUpdatedAt)
      .select()
      .maybeSingle();

    if (error) {
      return { success: false, conflict: false, error: error.message };
    }

    if (!data) {
      // No row matched — either deleted or updated_at changed (conflict)
      return { success: false, conflict: true, error: 'Record was modified by another session. Please refresh and try again.' };
    }

    return { success: true, conflict: false, data };
  } catch (err: any) {
    return { success: false, conflict: false, error: err?.message ?? 'Update failed' };
  }
}

// ---------------------------------------------------------------------------
// Pending Action Guard (prevents double-click)
// ---------------------------------------------------------------------------

const pendingActions = new Set<string>();

/**
 * Guard wrapper to prevent the same action from running concurrently.
 * Returns true if the action is now locked (proceed), false if already running.
 */
export function lockAction(actionKey: string): boolean {
  if (pendingActions.has(actionKey)) return false;
  pendingActions.add(actionKey);
  return true;
}

export function unlockAction(actionKey: string): void {
  pendingActions.delete(actionKey);
}

/**
 * Wrap an async action with lock/unlock guards.
 * If the action is already running, the call is silently ignored.
 */
export async function guardedAction<T>(
  actionKey: string,
  fn: () => Promise<T>
): Promise<T | null> {
  if (!lockAction(actionKey)) return null;
  try {
    return await fn();
  } finally {
    unlockAction(actionKey);
  }
}
