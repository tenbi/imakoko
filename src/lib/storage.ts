import { STORAGE_KEY } from './config';

// プライベートブラウズや設定によっては localStorage 自体が例外を投げるので、
// 読み書きは必ず握って呼び出し側に判断させる。
export const loadToken = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

export const saveToken = (token: string): boolean => {
  try {
    localStorage.setItem(STORAGE_KEY, token);
    return true;
  } catch {
    return false;
  }
};

export const clearToken = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 消せなくても続行する
  }
};
