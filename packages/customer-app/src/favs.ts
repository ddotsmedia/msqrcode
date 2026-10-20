// Favourite products and the branch the customer last ordered from. Stored on this phone only.
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVS = 'msq_favs';
export const LAST_BRANCH = 'msq_last_branch';

export async function getFavs(): Promise<string[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(FAVS)) ?? '[]');
  } catch {
    return [];
  }
}

export async function toggleFav(id: string): Promise<string[]> {
  const current = await getFavs();
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  await AsyncStorage.setItem(FAVS, JSON.stringify(next));
  return next;
}

export const getLastBranch = () => AsyncStorage.getItem(LAST_BRANCH).catch(() => null);
