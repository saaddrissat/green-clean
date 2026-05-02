"use client";

import { useCallback, useEffect, useState } from "react";

import { addHardwareLog } from "@/lib/hardware/debug-log";
import { escPosUsbPrinter } from "@/lib/hardware/escpos/usb-printer";

const STORAGE_KEY = "gc.hardware.printer.connected";

export function useEscPosPrinter() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError("");
    try {
      await escPosUsbPrinter.connect();
      setIsConnected(true);
      window.localStorage.setItem(STORAGE_KEY, "1");
      addHardwareLog("info", "Imprimante connectee via WebUSB.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connexion imprimante impossible.";
      setError(message);
      addHardwareLog("error", `Echec connexion imprimante: ${message}`);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    const shouldReconnect = window.localStorage.getItem(STORAGE_KEY) === "1";
    if (!shouldReconnect) {
      return;
    }

    let cancelled = false;
    const reconnect = async () => {
      setIsConnecting(true);
      try {
        const connected = await escPosUsbPrinter.reconnectKnownDevice();
        if (!cancelled) {
          setIsConnected(connected);
          if (connected) {
            addHardwareLog("info", "Reconnexion automatique imprimante reussie.");
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Reconnexion auto echouee.";
          setError(message);
          setIsConnected(false);
          addHardwareLog("error", `Reconnexion auto imprimante echouee: ${message}`);
        }
      } finally {
        if (!cancelled) {
          setIsConnecting(false);
        }
      }
    };
    reconnect();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
  };
}
