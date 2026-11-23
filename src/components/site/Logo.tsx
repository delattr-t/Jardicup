/* Marque : une tour à étages accrochée à deux barreaux, en un trait. */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <path d="M4 3v22M24 3v22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M10 25h8M11 25V9.5a3 3 0 0 1 6 0V25" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M11 13.5c-2.6 0-4.3-1.3-4.9-3.6 2.6-.2 4.3.9 4.9 3.6Zm6 4c2.6 0 4.3-1.3 4.9-3.6-2.6-.2-4.3.9-4.9 3.6Zm-6 4c-2.6 0-4.3-1.3-4.9-3.6 2.6-.2 4.3.9 4.9 3.6Z" fill="currentColor" />
    </svg>
  );
}
