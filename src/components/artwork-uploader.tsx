"use client";

import { useState } from "react";
import { ARTWORK_EXTENSIONS, MAX_UPLOAD_BYTES, artworkExtension } from "@/lib/uploads";

export function ArtworkUploader({ jobId, requestId }: { jobId?: string; requestId?: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("file");
    const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
    if (!file) return;
    if (!artworkExtension(file.name)) {
      setMessage("Use a PDF, AI, EPS, PNG or JPG file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setMessage("That file is over 80 MB.");
      return;
    }
    const body = new FormData();
    body.set("file", file);
    if (jobId) body.set("jobId", jobId);
    if (requestId) body.set("requestId", requestId);
    setPending(true);
    setMessage("");
    const response = await fetch("/api/artwork", { method: "POST", body });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setMessage(data.error || "Upload failed.");
      return;
    }
    window.location.reload();
  }

  return (
    <form className="upload" onSubmit={onSubmit}>
      <input name="file" type="file" accept={ARTWORK_EXTENSIONS.map((ext) => `.${ext}`).join(",")} required />
      <button className="btn btn-small" disabled={pending} type="submit">
        {pending ? "Uploading…" : "Upload artwork"}
      </button>
      {message ? <p className="error">{message}</p> : null}
    </form>
  );
}
