"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = {
  intervalMs?: number;
};

export default function AutomationAutoRefresh({
  intervalMs = 5000,
}: Props) {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [router, intervalMs]);

  return null;
}