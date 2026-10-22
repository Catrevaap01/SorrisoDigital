import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export const isNetworkOnline = (state: NetInfoState): boolean =>
  state.isConnected === true && state.isInternetReachable !== false;

export const isNetworkOffline = (state: NetInfoState): boolean => !isNetworkOnline(state);

export const fetchIsOnline = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return isNetworkOnline(state);
};
