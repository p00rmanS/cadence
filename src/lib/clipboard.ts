/**
 * Copies some text to the computer's clipboard (what "Copy link" buttons use). Returns true when it worked.
 * Modern browsers have `navigator.clipboard`, but it only works on secure pages and can be refused (for
 * example on an old phone or in a private window), so there is a fallback that selects the text in a hidden
 * box and uses the older copy command. Nothing is sent anywhere: this only touches the clipboard.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* refused: try the older way below */
  }
  try {
    const box = document.createElement("textarea");
    box.value = text;
    box.setAttribute("readonly", "");
    box.style.position = "fixed";
    box.style.opacity = "0";
    document.body.appendChild(box);
    box.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(box);
    return copied;
  } catch {
    return false;
  }
}
