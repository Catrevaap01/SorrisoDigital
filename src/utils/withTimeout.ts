/**
 * Platform-aware timeout wrapper for Supabase queries.
 * Web keeps a longer minimum because browser/network startup is slower.
 */
import { Platform } from 'react-native';

export const withTimeout = async <T = any>(
  promiseLike: Promise<T> | any,
  msOverride?: number
): Promise<T> => {
  const defaultMs = Platform.OS === 'web' ? 25000 : 12000;
  const requestedMs = msOverride ?? defaultMs;
  const ms = Platform.OS === 'web' ? Math.max(requestedMs, 25000) : requestedMs;

  const promise = Promise.resolve(promiseLike);

  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`A consulta demorou mais que ${Math.round(ms / 1000)}s. Tente atualizar novamente.`)),
        ms
      )
    ),
  ]) as Promise<T>;
};
