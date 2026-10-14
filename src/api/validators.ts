import { INSTANCE_SETTING_KEYS } from "./constants";
import type { Settings } from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateApiUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Укажите полный HTTPS apiUrl из кабинета GREEN-API");
  }

  if (
    url.protocol !== "https:" ||
    !/^(?:\d+\.)?api\.(?:green-api|greenapi)\.com$/.test(url.hostname) ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    !["", "/"].includes(url.pathname)
  ) {
    throw new Error(
      "Укажите HTTPS apiUrl WhatsApp-инстанса из кабинета GREEN-API",
    );
  }

  return url.origin;
}

export function validateInstanceId(value: string): string {
  const id = value.trim();

  if (!/^\d+$/.test(id)) {
    throw new Error("idInstance должен содержать только цифры");
  }

  return id;
}

export function normalizePhone(value: string): string {
  if (!/^[+\d\s()-]+$/.test(value))
    throw new Error("Номер может содержать цифры, пробелы, +, скобки и дефисы");
  const phone = value.replace(/\D/g, "");

  if (!/^[1-9]\d{10,15}$/.test(phone)) {
    throw new Error(
      "Укажите номер с кодом страны: от 11 до 16 цифр, без начального нуля",
    );
  }

  return phone;
}

export function isSettings(value: unknown): value is Settings {
  return (
    isRecord(value) &&
    INSTANCE_SETTING_KEYS.every((key) => typeof value[key] === "string")
  );
}
