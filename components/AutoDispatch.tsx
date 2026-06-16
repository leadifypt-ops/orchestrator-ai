"use client";

import { useEffect } from "react";

type AutoDispatchProps = {
  enabled?: boolean;
};

export default function AutoDispatch({ enabled = false }: AutoDispatchProps) {
  useEffect(() => {
    if (!enabled) return;

    let running = false;

    const interval = setInterval(async () => {
      if (running) return;

      try {
        running = true;

        await fetch("/api/dispatch", {
          method: "POST",
        });
      } catch (err) {
        console.error("Auto dispatch error", err);
      } finally {
        running = false;
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [enabled]);

  return null;
}
