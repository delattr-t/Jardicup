"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  poster: string;
  label: string;
  className?: string;
  /** lit en boucle, sans son, quand visible */
  autoplay?: boolean;
}

/* Vidéo de rendu : muette, en boucle, lancée seulement quand elle entre à l'écran
   et mise en pause quand elle en sort, pour ne pas charger trois flux à la fois. */
export default function Video({ src, poster, label, className = "", autoplay = true }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v || !autoplay) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().then(() => setPlaying(true)).catch(() => {});
        else { v.pause(); setPlaying(false); }
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [autoplay]);
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().then(() => setPlaying(true)).catch(() => {});
    else { v.pause(); setPlaying(false); }
  };
  return (
    <figure className={`video-frame relative overflow-hidden rounded-xl bg-slate ${className}`}>
      <video ref={ref} src={src} poster={poster} muted loop playsInline preload="metadata" aria-label={label} onClick={toggle} />
      <button type="button" onClick={toggle} aria-label={playing ? "Mettre en pause" : "Lire"} className="absolute bottom-3 right-3 grid size-10 place-items-center rounded-full bg-paper/90 text-iron shadow-[var(--shadow-lift)] transition-transform duration-150 ease-[var(--ease-out)] active:scale-95">
        {playing ? (
          <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true"><path d="M6 4h3v12H6zM11 4h3v12h-3z" fill="currentColor" /></svg>
        ) : (
          <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true"><path d="M6 4l10 6-10 6z" fill="currentColor" /></svg>
        )}
      </button>
      <figcaption className="absolute left-3 top-3 rounded-md bg-iron/75 px-2.5 py-1.5 text-[0.78rem] font-medium text-stone backdrop-blur-sm">{label}</figcaption>
    </figure>
  );
}
