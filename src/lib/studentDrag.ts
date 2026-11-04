import type { DragEvent } from "react";

/**
 * Drag and drop of a student card onto a time in the schedule grid. This file holds the little bit both
 * sides share: the card says "I am carrying student X" when it is picked up, and the grid recognises that
 * (and only that) when something is dragged over it, so dragging a file or some text never does anything.
 */

/** The label the browser attaches to a dragged student; any other kind of drag is ignored by the grid. */
const STUDENT_DRAG_TYPE = "application/x-syncro-student";

/** Called when a student card is picked up: records which student it is. */
export function startStudentDrag(event: DragEvent, studentId: string): void {
  event.dataTransfer.setData(STUDENT_DRAG_TYPE, studentId);
  event.dataTransfer.effectAllowed = "copy";
}

/** True while a student card (not a file or text) is being dragged. Browsers only reveal the labels during a drag, not the contents. */
export function isStudentDrag(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes(STUDENT_DRAG_TYPE);
}

/** The id of the student that was dropped, or null if the drop was something else. */
export function droppedStudentId(event: DragEvent): string | null {
  const id = event.dataTransfer.getData(STUDENT_DRAG_TYPE);
  return id || null;
}
