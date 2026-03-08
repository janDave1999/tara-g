/**
 * uploadQueue — singleton background upload manager.
 *
 * Usage:
 *   import { queueUpload } from "@/scripts/uploadQueue";
 *   queueUpload(async () => { ... your upload logic ... });
 *
 * Fires document events:
 *   upload:start  — upload began
 *   upload:done   — upload succeeded (detail: CustomEvent payload from task)
 *   upload:error  — upload failed
 *
 * Also blocks beforeunload while an upload is in flight.
 */

let active = false;

function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  // Chrome requires returnValue to be set
  e.returnValue = "";
}

/**
 * Runs `task` in the background.  Closes the caller's modal before awaiting.
 * Only one upload runs at a time — subsequent calls while busy are ignored.
 */
export async function queueUpload(task: () => Promise<void>): Promise<void> {
  if (active) return;
  active = true;

  window.addEventListener("beforeunload", onBeforeUnload);
  document.dispatchEvent(new CustomEvent("upload:start"));

  try {
    await task();
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
