"use client";

import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";

function normalizeAlertMessage(message: unknown) {
  if (typeof message === "string") return message.trim();
  if (message instanceof Error) return message.message.trim();
  if (message === null || message === undefined) return "";

  try {
    const serialized = JSON.stringify(message);
    return serialized === "{}" ? String(message) : serialized;
  } catch {
    return String(message);
  }
}

function classifyAlert(message: string) {
  const value = message.toLowerCase();

  if (/(exito|éxito|exitosamente|aprobad|guardad|cread|enviado|actualizad|eliminad)/.test(value)) {
    return { title: "Éxito", variant: "default" as const };
  }

  if (/(error|no se pudo|fall|inválid|required|requerid|obligatori|prohibid|denegad|debes|selecciona|escribe)/.test(value)) {
    return { title: "Atención", variant: "destructive" as const };
  }

  return { title: "Aviso", variant: "default" as const };
}

export function GlobalAlertToast() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalAlert = window.alert.bind(window);

    window.alert = (message?: unknown) => {
      const normalized = normalizeAlertMessage(message);
      if (!normalized) return;

      const meta = classifyAlert(normalized);
      toast({
        title: meta.title,
        description: normalized,
        variant: meta.variant,
      });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  return null;
}