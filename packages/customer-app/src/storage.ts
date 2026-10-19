// Same key as the website, so a card linked on one device is remembered on the app too.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'milestones_loyalty_token';
export const getCardToken = () => AsyncStorage.getItem(KEY);
export const setCardToken = (t: string) => AsyncStorage.setItem(KEY, t);
export const clearCardToken = () => AsyncStorage.removeItem(KEY);
