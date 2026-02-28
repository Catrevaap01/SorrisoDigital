import Toast from 'react-native-toast-message';

let Notifications: any = null;
try {
  // Optional dependency: expo-notifications
  // eslint-disable-next-line global-require
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

let configured = false;

const ensureConfigured = async (): Promise<void> => {
  if (!Notifications || configured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      await Notifications.requestPermissionsAsync();
    }
  } catch {
    // Ignore permission errors and fallback to toast
  }

  configured = true;
};

export const notifyNewMessage = async (
  title: string,
  body: string
): Promise<void> => {
  if (!Notifications) {
    Toast.show({
      type: 'info',
      text1: title,
      text2: body,
    });
    return;
  }

  await ensureConfigured();

  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch {
    Toast.show({
      type: 'info',
      text1: title,
      text2: body,
    });
  }
};

