export function Logo({ light = false }: { light?: boolean }) {
  const ink = light ? "#f6f1e7" : "#142033";
  const amber = "#e0a322";
  return (
    <div className="brand">
      <svg className="mark" viewBox="0 0 36 36" aria-hidden>
        <rect x="1" y="1" width="10" height="2" fill={amber} />
        <rect x="1" y="1" width="2" height="10" fill={amber} />
        <rect x="25" y="33" width="10" height="2" fill={amber} />
        <rect x="33" y="25" width="2" height="10" fill={amber} />
        <text x="8" y="24" fill={ink} fontSize="13" fontFamily="Georgia, serif">
          PS
        </text>
      </svg>
      <div>
        <strong style={{ color: ink }}>Print and Sign Co</strong>
        <span>Osborne Park</span>
      </div>
    </div>
  );
}
