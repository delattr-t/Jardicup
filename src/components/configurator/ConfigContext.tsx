"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Config, DEFAULT_CONFIG, NumKey, loadConfig, normalize, saveConfig, setNum } from "@/lib/config";

interface Ctx {
  config: Config;
  hydrated: boolean;
  set: <K extends keyof Config>(k: K, v: Config[K]) => void;
  setNumber: (k: NumKey, display: number | string) => void;
  patch: (p: Partial<Config>) => void;
  reset: () => void;
}
const C = createContext<Ctx | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [hydrated, setHydrated] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    setConfig(loadConfig());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (hydrated) saveConfig(config);
  }, [config, hydrated]);

  const set = useCallback(<K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => normalize({ ...c, [k]: v })), []);
  const setNumber = useCallback((k: NumKey, d: number | string) => setConfig((c) => setNum(c, k, d)), []);
  const patch = useCallback((p: Partial<Config>) => setConfig((c) => normalize({ ...c, ...p })), []);
  const reset = useCallback(() => setConfig(DEFAULT_CONFIG), []);

  const value = useMemo(() => ({ config, hydrated, set, setNumber, patch, reset }), [config, hydrated, set, setNumber, patch, reset]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useConfig() {
  const v = useContext(C);
  if (!v) throw new Error("useConfig hors ConfigProvider");
  return v;
}
