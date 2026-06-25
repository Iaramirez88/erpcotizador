"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ToastAction } from "@/components/ui/toast";
import { toast } from "@/hooks/use-toast";

type NotificationItem = {
  id: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR" | string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  actionLabel: string | null;
};

function mapVariant(type: NotificationItem["type"]) {
  return type === "ERROR" ? "destructive" as const : "default" as const;
}

export function NotificationToastBridge() {
  const initializedRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function pollNotifications() {
      try {
        const response = await fetch("/api/notificaciones?unread=true&limit=10", { cache: "no-store" });
        if (!response.ok) return;

        const json = (await response.json().catch(() => null)) as
          | { ok?: boolean; items?: NotificationItem[] }
          | null;

        if (cancelled || !json?.ok || !Array.isArray(json.items)) return;

        const items = json.items;
        const nextIds = new Set(items.map((item) => item.id));

        if (!initializedRef.current) {
          seenIdsRef.current = nextIds;
          initializedRef.current = true;
          return;
        }

        const freshItems = items.filter((item) => !seenIdsRef.current.has(item.id));
        seenIdsRef.current = nextIds;

        freshItems
          .slice()
          .reverse()
          .slice(0, 3)
          .forEach((item) => {
            toast({
              title: item.title,
              description: item.body || "Nueva notificación del sistema.",
              variant: mapVariant(item.type),
              action: item.actionUrl ? (
                <ToastAction altText={item.actionLabel || "Abrir notificación"} asChild>
                  <Link href={`/dashboard/notificaciones/open/${item.id}`}>{item.actionLabel || "Abrir"}</Link>
                </ToastAction>
              ) : undefined,
            });
          });
      } catch {
        // ignore polling errors
      }
    }

    void pollNotifications();
    const intervalId = window.setInterval(() => void pollNotifications(), 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
}