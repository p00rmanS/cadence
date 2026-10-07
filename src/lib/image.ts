import { AVATAR_SIZE, MAX_AVATAR_CHARS, MAX_AVATAR_UPLOAD_BYTES } from "../features/scheduling/constants";

/**
 * ============================================================================
 *  PROFILE PHOTOS: CHECK, SHRINK, SAVE AS TEXT
 * ============================================================================
 * A person may pick a photo up to 5 MB, but the app never stores that file. It is checked,
 * cropped to a centered square, shrunk to a small thumbnail (AVATAR_SIZE px) and re-encoded as a
 * JPEG "data URL" — the picture written out as a short piece of text — which is small enough to
 * live inside the schedule's normal saved data and in backup files. Everything happens in the
 * browser: the photo is never uploaded anywhere. Re-encoding through a canvas also throws away
 * any hidden metadata in the original (GPS location, camera details).
 */

export const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Plain-language problem with a chosen file, or null if it can be used. */
export function checkAvatarFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) return "Please choose a PNG, JPG or WebP photo.";
  if (file.size > MAX_AVATAR_UPLOAD_BYTES) return "That photo is bigger than 5 MB. Please choose a smaller one.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

const DATA_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * True only for a thumbnail this app could have made itself: a JPEG data URL of limited length.
 * Used on everything loaded from storage or a backup file, since those can be edited by hand.
 */
export function isValidAvatar(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_AVATAR_CHARS && DATA_URL.test(value);
}

/** Crops the middle square out of a width x height image: where to start and how long each side is. */
export function centerSquare(width: number, height: number): { x: number; y: number; side: number } {
  const side = Math.min(width, height);
  return { x: Math.floor((width - side) / 2), y: Math.floor((height - side) / 2), side };
}

/**
 * Turns a chosen photo into a saved thumbnail. Rejects (with a plain-language message) if the
 * file is not a usable image or cannot be shrunk small enough.
 */
export async function makeAvatar(file: File): Promise<string> {
  const problem = checkAvatarFile(file);
  if (problem) throw new Error(problem);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file couldn't be opened as a photo. Try a different one.");
  }
  try {
    const { x, y, side } = centerSquare(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser can't resize photos.");
    ctx.fillStyle = "#ffffff"; // a transparent PNG would otherwise turn black in a JPEG
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    ctx.drawImage(bitmap, x, y, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    for (const quality of [0.85, 0.75, 0.65, 0.5, 0.4]) {
      const url = canvas.toDataURL("image/jpeg", quality);
      if (isValidAvatar(url)) return url;
    }
    throw new Error("That photo is too detailed to shrink small enough. Try a simpler one.");
  } finally {
    bitmap.close();
  }
}
