
export function Mark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <g fill="#F0A202">
        <path d="M14 26h44 L50 50 H61 L53 74 H14 a6 6 0 0 1 -6 -6 V32 a6 6 0 0 1 6 -6z" />
        <g transform="rotate(9 78 50) translate(7 -3)">
          <path d="M64 26 H86 a6 6 0 0 1 6 6 V68 a6 6 0 0 1 -6 6 H60 L68 50 H57 Z" />
        </g>
      </g>
    </svg>
  );
}
