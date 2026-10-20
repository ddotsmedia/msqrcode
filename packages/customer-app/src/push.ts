// Native push for the customer app. The server already sends via FCM (Android) and APNs (iPhone);
// this registers the phone's token with /push/devices, linked to the rewards card when there is one.
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { API } from './api';
import { getCardToken } from './storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function registerForPush(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Milestones', importance: Notifications.AndroidImportance.HIGH });
    }
    const device = await Notifications.getDevicePushTokenAsync();
    const token = String(device.data);
    const loyalty = (await getCardToken()) ?? '';
    await fetch(`${API}/push/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android', loyalty_token: loyalty }),
    });
  } catch {
    // Push is optional: the app works without it.
  }
}
