// Company account this phone orders on (pickup only). Set from the account link or the business portal.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'msq_business_token';
export const getBusinessToken = () => AsyncStorage.getItem(KEY);
export const setBusinessToken = (t: string) => AsyncStorage.setItem(KEY, t.trim());
export const clearBusinessToken = () => AsyncStorage.removeItem(KEY);
