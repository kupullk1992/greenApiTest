import { validateApiUrl } from "../api/validators";
import { API_URL_STORAGE_KEY } from "./constants";

export function readApiUrl(): string {
  try {
    const value = localStorage.getItem(API_URL_STORAGE_KEY);

    return value ? validateApiUrl(value) : "";
  } catch {
    return "";
  }
}

export function rememberApiUrl(value: string): void {
  try {
    localStorage.setItem(API_URL_STORAGE_KEY, validateApiUrl(value.trim()));
  } catch {
    // ignore
  }
}
