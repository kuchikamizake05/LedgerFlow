export function FlowMark({ className = "" }: { className?: string }) {
  return (
    <svg className={`flow-mark ${className}`} viewBox="0 0 48 36" fill="none" aria-hidden="true" focusable="false">
      <path d="M8 10h12c12 0 18 6 18 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="8" cy="10" r="4" fill="currentColor" />
      <circle cx="38" cy="25" r="4" fill="var(--lime)" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
