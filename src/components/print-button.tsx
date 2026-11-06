"use client";

export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <button className="btn btn-primary" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
