// Menu data that still works offline: the last good response is kept on the phone.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getJson } from './api';

export async function cachedJson<T>(key: string, path: string): Promise<T> {
  try {
    const data = await getJson<T>(path);
    AsyncStorage.setItem(`msq_cache_${key}`, JSON.stringify(data)).catch(() => undefined);
    return data;
  } catch (e) {
    const raw = await AsyncStorage.getItem(`msq_cache_${key}`).catch(() => null);
    if (raw) return JSON.parse(raw) as T;
    throw e;
  }
}
