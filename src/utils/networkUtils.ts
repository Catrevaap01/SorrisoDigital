import { Platform } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export const isNetworkOnline = (state: NetInfoState): boolean => {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  return state.isConnected === true && state.isInternetReachable !== false;
};

export const isNetworkOffline = (state: NetInfoState): boolean => !isNetworkOnline(state);

export const fetchIsOnline = async (): Promise<boolean> => {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  try {
    const state = await NetInfo.fetch();
    return isNetworkOnline(state);
  } catch {
    return Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.onLine : true;
  }
};

/**
 * Detects whether an error/response object was caused by a network outage or timeout,
 * even if NetInfo hasn't fired the offline event yet.
 */
export const isLikelyNetworkError = (err: any): boolean => {
  if (!err) return false;
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }

  const msg = String(
    typeof err === 'string'
      ? err
      : err?.message || err?.error_description || err?.details || ''
  ).toLowerCase();

  return (
    msg.includes('failed to fetch') ||
    msg.includes('network request failed') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('load failed') ||
    msg.includes('err_internet_disconnected') ||
    msg.includes('err_network') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('aborted') ||
    msg.includes('offline') ||
    err?.status === 0 ||
    err?.status === 503
  );
};

/**
 * Returns true if the device is offline OR if the given error indicates a network failure.
 */
export const shouldQueueOffline = async (err?: any): Promise<boolean> => {
  if (isLikelyNetworkError(err)) return true;
  const online = await fetchIsOnline();
  return !online;
};
