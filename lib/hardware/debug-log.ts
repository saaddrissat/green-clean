export type HardwareLogLevel = "info" | "error";

export type HardwareLogEntry = {
  id: string;
  timestamp: string;
  level: HardwareLogLevel;
  message: string;
};

const STORAGE_KEY = "gc.hardware.logs";
const MAX_LOGS = 200;

const isBrowser = () => typeof window !== "undefined";

export const getHardwareLogs = (): HardwareLogEntry[] => {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as HardwareLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistLogs = (logs: HardwareLogEntry[]) => {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_LOGS)));
  window.dispatchEvent(new Event("gc-hardware-logs-updated"));
};

export const addHardwareLog = (level: HardwareLogLevel, message: string) => {
  const entry: HardwareLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  const current = getHardwareLogs();
  persistLogs([entry, ...current]);
};

export const clearHardwareLogs = () => {
  persistLogs([]);
};
