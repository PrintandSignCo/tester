"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { artworkExtension, MAX_UPLOAD_BYTES } from "@/lib/uploads";

export function RequestForm({ products }: { products: string[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [other, setOther] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const files = form.elements.namedItem("files");
    const list = files instanceof HTMLInputElement && files.files ? Array.from(files.files) : [];
    for (const file of list) {
      if (!artworkExtension(file.name)) {
        setError(`${file.name} needs to be a PDF, AI, EPS, PNG or JPG.`);
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(`${file.name} is over 80 MB.`);
        return;
      }
    }
    setPending(true);
    setError("");
    const response = await fetch("/api/portal/requests", { method: "POST", body: new FormData(form) });
    const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
    setPending(false);
    if (data.id) {
      router.push(`/portal/requests/${data.id}?notice=${encodeURIComponent(data.error || "Request sent to the shop.")}`);
      router.refresh();
      return;
    }
    setError(data.error || "The request could not be sent.");
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <label className="field">
        <span className="label">What do you need?</span>
        <input className="input" name="title" required placeholder="Reception sign, window frosting…" />
      </label>
      <div className="form-grid">
        <label className="field">
          <span className="label">Material</span>
          <select className="select" name="material" defaultValue={products[0] ?? "Other"} onChange={(event) => setOther(event.target.value === "Other")}>
            {products.map((name) => (
              <option key={name}>{name}</option>
            ))}
            <option>Other</option>
          </select>
        </label>
        {other ? (
          <label className="field">
            <span className="label">Other material</span>
            <input className="input" name="materialOther" />
          </label>
        ) : null}
        <label className="field">
          <span className="label">Width mm</span>
          <input className="input" name="widthMm" type="number" min={0} defaultValue={1200} required />
        </label>
        <label className="field">
          <span className="label">Height mm</span>
          <input className="input" name="heightMm" type="number" min={0} defaultValue={900} required />
        </label>
        <label className="field">
          <span className="label">Qty</span>
          <input className="input" name="qty" type="number" min={1} defaultValue={1} required />
        </label>
        <label className="field">
          <span className="label">Needed by</span>
          <input className="input" name="dueDate" type="date" />
        </label>
      </div>
      <label className="field">
        <span className="label">Notes</span>
        <textarea name="notes" placeholder="Finishing, install, site access…" />
      </label>
      <label className="field">
        <span className="label">Artwork (PDF, AI, EPS, PNG, JPG, up to 80 MB each)</span>
        <input name="files" type="file" multiple accept=".pdf,.ai,.eps,.png,.jpg,.jpeg" />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn btn-primary" disabled={pending} type="submit">
        {pending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
