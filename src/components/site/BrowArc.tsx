/** Traço dourado inspirado no arco da sobrancelha — assinatura visual da marca. */
export function BrowArc({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 60" fill="none" aria-hidden="true" className={className}>
      <path
        className="arco-sobrancelha"
        d="M4 52 C 70 20, 150 6, 238 10 S 360 34, 396 50"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
