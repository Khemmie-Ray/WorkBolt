
export function Wordmark({
  className = "text-2xl",
  bolt = "#F0A202",
}: {
  className?: string;
  bolt?: string;
}) {
  return (
    <span
      role="img"
      aria-label="Workbolt"
      className={`inline-flex items-end font-display font-extrabold leading-none tracking-[-0.045em] ${className}`}
    >
      <span aria-hidden>workbo</span>
      <svg
        viewBox="0 0 26 66"
        aria-hidden
        className="mb-[0.06em] ml-[0.015em] mr-[0.01em] h-[0.95em] w-[0.375em] shrink-0"
      >
        <path d="M18 0 L3 36 L13 36 L7 66 L24 26 L14 26 L20 0 Z" fill={bolt} />
      </svg>
      <span aria-hidden>t</span>
    </span>
  );
}