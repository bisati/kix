export function Ball({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <circle cx="24" cy="24" r="21" fill="#fff" stroke="#1c1917" strokeWidth="3" />
      {/* center pentagon */}
      <path d="M24 15.5 31.5 21 28.6 30H19.4L16.5 21Z" fill="#1c1917" />
      {/* spokes to the seams */}
      <g stroke="#1c1917" strokeWidth="2.6" strokeLinecap="round">
        <path d="M24 15.5V6.5" />
        <path d="M31.5 21l8.6-3" />
        <path d="M28.6 30l5.6 7.2" />
        <path d="M19.4 30l-5.6 7.2" />
        <path d="M16.5 21l-8.6-3" />
      </g>
      {/* grass-stain wink */}
      <circle cx="35.5" cy="12.5" r="4.5" fill="var(--color-pop)" stroke="#1c1917" strokeWidth="2.4" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="group/logo inline-flex select-none items-center gap-2">
      <span className="logo-ball inline-flex">
        <Ball />
      </span>
      <span className="text-[1.7rem] font-extrabold leading-none tracking-tight text-ink">
        Kix
      </span>
    </span>
  );
}
