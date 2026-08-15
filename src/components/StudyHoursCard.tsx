"use client";

import { useCallback, useEffect, useState } from "react";
import {
  StudyStatusPanel,
  type StudyStats,
} from "@/components/StudyStatusPanel";

export function StudyHoursCard() {
  const [data, setData] = useState<StudyStats | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/study");
      if (!res.ok) return;
      setData((await res.json()) as StudyStats);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  if (!data?.status) return null;
  return <StudyStatusPanel data={data} compact />;
}
