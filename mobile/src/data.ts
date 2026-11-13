// Kalıcı depolama (AsyncStorage) + ortak çekirdeğin dışa aktarımları
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Data, migrate } from './core';

export * from './core';

const STORE_KEY = 'kal-data-v1';

export async function loadData(): Promise<Data> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    return migrate(raw ? JSON.parse(raw) : {});
  } catch {
    return migrate({});
  }
}

export async function saveData(data: Data): Promise<void> {
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(data));
}
