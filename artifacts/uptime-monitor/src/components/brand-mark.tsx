/**
 * GuardiX brand mark — a sentinel watchtower / fire-lookout tower.
 * Line-art, inherits currentColor. Reads cleanly down to ~16px.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* roof */}
      <path d="M4.5 8.5 L12 4 L19.5 8.5" />
      {/* cabin */}
      <path d="M7 8.5 H17 V13 H7 Z" />
      {/* observation slit */}
      <path d="M9.5 10.75 H14.5" />
      {/* splayed legs */}
      <path d="M8.5 13 L5.5 20.5" />
      <path d="M15.5 13 L18.5 20.5" />
      {/* mid brace */}
      <path d="M7 17 H17" />
    </svg>
  );
}
