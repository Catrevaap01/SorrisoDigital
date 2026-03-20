/**
 * Platform-aware timeout wrapper for Supabase queries
 * Web: 25s (slower networks), Native: 12s
 * Fixes web data loading timeouts
 * ✅ FIXED: Proper Supabase PostgrestResponse typing
 */
import { Platform } from 'react-native';
import { PostgrestResponse, PostgrestSingleResponse } from '@supabase/supabase-js';

type SupabaseResponse<T> = PostgrestResponse<T> | PostgrestSingleResponse<T>;

export const withTimeout = async <T = any>(
  promiseLike: Promise<T> | any,
  msOverride?: number
): Promise<T> => {
  // Platform-aware defaults: web slower networks
  const ms = msOverride ?? (Platform.OS === 'web' ? 25000 : 12000);
  
  const promise = Promise.resolve(promiseLike);
  
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Query timeout após ${Math.round(ms/1000)}s (platform: ${Platform.OS})`)), ms)
    )
  ]) as Promise<T>;
};



