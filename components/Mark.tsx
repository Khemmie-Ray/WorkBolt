
export function Mark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <path
        d="M6 8h28a2 2 0 0 1 2 2v6a4 4 0 0 0 0 8v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a4 4 0 0 0 0-8v-6a2 2 0 0 1 2-2z"
        fill="#F0A202"
      />
      <path d="M22.5 11 14 22h5.5L17 29l9-11.5h-5.6z" fill="#24163A" />
    </svg>
  );
}
