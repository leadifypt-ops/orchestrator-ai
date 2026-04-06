"use client";

import { useEffect } from "react";

export default function AutoDispatch() {
  useEffect(() => {
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
  }, []);

  return null;
}