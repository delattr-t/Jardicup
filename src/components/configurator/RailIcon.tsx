import { RailKind } from "@/lib/config";

/* Pictogrammes des cinq garde-corps : un seul trait, une seule graisse. */
export default function RailIcon({ kind, className = "" }: { kind: RailKind; className?: string }) {
  const st = { stroke: "currentColor", strokeLinecap: "round" as const, fill: "none" };
  let body: React.ReactNode;
  switch (kind) {
    case "barreaux":
      body = (
        <>
          <path {...st} strokeWidth={3} d="M4 8H56" />
          <path {...st} strokeWidth={2} d="M4 37H56" />
          {[10, 17, 24, 31, 38, 45, 52].map((x) => <path key={x} {...st} strokeWidth={1.7} d={`M${x} 9V37`} />)}
        </>
      );
      break;
    case "vitre":
      body = (
        <>
          <rect x={6} y={9} width={48} height={29} fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeWidth={1.6} />
          <path {...st} strokeWidth={3} d="M4 8H56" />
          <path {...st} strokeWidth={1.4} d="M14 32 24 14M20 32 28 18" />
        </>
      );
      break;
    case "plein":
      body = (
        <>
          <rect x={5} y={8} width={50} height={31} fill="currentColor" fillOpacity={0.35} />
          <path {...st} strokeWidth={2} d="M5 8H55V39H5Z" />
        </>
      );
      break;
    case "grillage": {
      let g = "";
      for (let x = 11; x < 54; x += 6) g += `M${x} 9V38`;
      for (let y = 14; y < 38; y += 6) g += `M6 ${y}H54`;
      body = (
        <>
          <path {...st} strokeWidth={1} d={g} />
          <path {...st} strokeWidth={2.6} d="M6 8H54V38H6Z" />
        </>
      );
      break;
    }
    default:
      body = (
        <>
          <rect x={4} y={24} width={52} height={15} fill="currentColor" fillOpacity={0.35} />
          <path {...st} strokeWidth={2} d="M4 24H56" />
          <path {...st} strokeWidth={2} d="M12 9V24M30 9V24M48 9V24" />
          <path {...st} strokeWidth={3.6} d="M3 8H57" />
        </>
      );
  }
  return (
    <svg viewBox="0 0 60 44" aria-hidden="true" className={className}>
      {body}
      <path {...st} strokeWidth={1.4} strokeDasharray="2 3" d="M1 42H59" />
    </svg>
  );
}
