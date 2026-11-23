"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function MerciClient() {
  const sp = useSearchParams();
  const ref = sp.get("ref");
  const [info, setInfo] = useState<{ prenom?: string; email?: string }>({});
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("jardicup.lastReservation");
      if (raw) setInfo(JSON.parse(raw));
    } catch {}
  }, []);
  if (!ref) return null;
  return (
    <p className="mt-4 text-[1.05rem]">
      {info.prenom ? `Merci ${info.prenom}. ` : "Merci. "}Référence <b className="tnum">{ref}</b>
      {info.email && <> — gardez-la, nous vous écrirons à <b>{info.email}</b>.</>}
    </p>
  );
}
