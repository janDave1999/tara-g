/**
 * uploadQueue — singleton background upload manager.
 *
 * Usage:
 *   import { queueUpload } from "@/scripts/uploadQueue";
 *   queueUpload(async (onProgress) => { onProgress(50); ... });
 *
 * Fires document events:
 *   upload:start    — upload began
 *   upload:progress — { detail: number } 0–100
 *   upload:done     — upload succeeded
 *   upload:error    — upload failed
 *
 * Also blocks beforeunload while an upload is in flight.
 */

let active = false;

function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  e.returnValue = "";
}

/**
 * Runs `task` in the background.
 * `task` receives an `onProgress(pct)` callback (0–100) to report progress.
 * Only one upload runs at a time — subsequent calls while busy are ignored.
 */
export async function queueUpload(
  task: (onProgress: (pct: number) => void) => Promise<void>,
): Promise<void> {
  if (active) return;
  active = true;

  window.addEventListener("beforeunload", onBeforeUnload);
  document.dispatchEvent(new CustomEvent("upload:start"));

  const onProgress = (pct: number) => {
    document.dispatchEvent(new CustomEvent("upload:progress", { detail: Math.min(100, Math.max(0, pct)) }));
  };

  try {
    await task(onProgress);
    onProgress(100);
    document.dispatchEvent(new CustomEvent("upload:done"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    document.dispatchEvent(new CustomEvent("upload:error", { detail: message }));
  } finally {
    active = false;
    window.removeEventListener("beforeunload", onBeforeUnload);
  }
}

/** Returns true if an upload is currently running */
export function isUploading(): boolean {
  return active;
}
