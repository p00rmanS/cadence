import { blockedBySlot, daySlots, hasOpeningShift } from "./availability";
import {
  MAX_SHIFT_MINUTES,
  MIN_OPENING_SHIFT_MINUTES,
  MIN_SHIFT_MINUTES,
  OPENING_SHIFT_START,
  RELAXED_DAY_EXTRA_HOURS,
} from "./constants";
import { formatMinutes, formatRange } from "./time";
import { DAYS, DAY_LABEL } from "./types";
import type {
  AutoFillExplanation,
  AutoFillResult,
  Day,
  Minutes,
  ScheduleSettings,
  ShiftBlock,
  Student,
} from "./types";

/**
 * ============================================================================
 *  "FILL SCHEDULE FOR ME" — THE AUTO-FILL PLANNER
 * ============================================================================
 * This is the most complex file in the app: the code behind the "Fill
 * schedule for me" button. In plain terms, it tries lots of possible shifts,
 * scores each one (a lower score is better), and repeatedly places the
 * best-scoring one until the week is staffed and everyone is near their
 * target hours. It is NOT artificial intelligence — it's an ordinary,
 * rules-based algorithm (a "greedy" planner, in scheduling-textbook terms).
 * Given the exact same students and settings, it always produces the exact
 * same schedule; nothing about it is random or learned.
 *
 * Reading order: `autoFill` at the bottom of this file is the entry point —
 * start there, then come back up to `Plan`/`evaluate`/`place` as you need
 * them. It runs in three phases, explained where each phase begins below.
 */

export type AutoFillOptions = {
  /** Drop earlier auto-filled shifts and rebuild them; manual shifts are always kept. */
  replaceAutoFilled?: boolean;
};

/**
 * Ids come from content (student/day/slot), not a counter or timestamp, so the
 * scheduler's output — ids included — is identical for identical input.
 */
function shiftId(studentId: string, day: Day, slotStart: Minutes): string {
  return `auto-${studentId}-${day}-${slotStart}`;
}

/** Reassigns nothing; dedupes by student/day/slot and orders day, time, student. */
export function normalizeAssignments(assignments: ShiftBlock[]): ShiftBlock[] {
  const seen = new Set<string>();
  const out: ShiftBlock[] = [];
  for (const a of assignments) {
    const key = `${a.studentId}|${a.day}|${a.start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out.sort(
    (a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.start - b.start || a.studentId.localeCompare(b.studentId),
  );
}

/**
 * Fast in-memory index of the schedule being built, so candidate scoring stays cheap.
 * Think of this as a scratchpad copy of the schedule the planner builds up shift by
 * shift while it works — it is thrown away once `autoFill` returns; only the final
 * `blocks` array (the list of shifts it decided on) matters to the rest of the app.
 * It exists purely for speed: looking up "how many hours does this student already
 * have?" from a plain array of shifts would mean re-counting every time, which gets
 * slow with a big roster. The `Map`s below keep running totals instead.
 */
class Plan {
  private cells = new Set<string>();
  private staffCounts = new Map<string, number>();
  private hoursByStudent = new Map<string, number>();
  private hoursByStudentDay = new Map<string, number>();
  private daysByStudent = new Map<string, Set<Day>>();
  readonly blocks: ShiftBlock[] = [];

  constructor(
    private readonly settings: ScheduleSettings,
    initial: ShiftBlock[],
  ) {
    for (const block of initial) this.add(block);
  }

  has(studentId: string, day: Day, start: Minutes): boolean {
    return this.cells.has(`${studentId}|${day}|${start}`);
  }
  staff(day: Day, start: Minutes): number {
    return this.staffCounts.get(`${day}|${start}`) ?? 0;
  }
  hours(studentId: string): number {
    return this.hoursByStudent.get(studentId) ?? 0;
  }
  hoursOn(studentId: string, day: Day): number {
    return this.hoursByStudentDay.get(`${studentId}|${day}`) ?? 0;
  }
  daysUsed(studentId: string): number {
    return this.daysByStudent.get(studentId)?.size ?? 0;
  }
  add(block: ShiftBlock): void {
    const key = `${block.studentId}|${block.day}|${block.start}`;
    if (this.cells.has(key)) return;
    this.cells.add(key);
    this.blocks.push(block);
    const hours = this.settings.slotMinutes / 60;
    const staffKey = `${block.day}|${block.start}`;
    this.staffCounts.set(staffKey, (this.staffCounts.get(staffKey) ?? 0) + 1);
    this.hoursByStudent.set(block.studentId, this.hours(block.studentId) + hours);
    this.hoursByStudentDay.set(
      `${block.studentId}|${block.day}`,
      this.hoursOn(block.studentId, block.day) + hours,
    );
    const days = this.daysByStudent.get(block.studentId) ?? new Set<Day>();
    days.add(block.day);
    this.daysByStudent.set(block.studentId, days);
  }
}

/**
 * One possible shift the planner considered: "give this student this block of
 * slots on this day". `score` is how good an idea it is (lower = better — see
 * `evaluate` and `compareCandidates`); `gain` is how many empty required-staff
 * slots it would fill. The planner generates many of these, keeps the best one,
 * places it (`place`), and repeats.
 */
type Candidate = {
  student: Student;
  studentIndex: number;
  day: Day;
  startIdx: number;
  len: number;
  score: number;
  gain: number;
};

function preferenceMismatches(student: Student, slotStarts: Minutes[]): number {
  const noon = 12 * 60;
  if (student.preference === "morning") return slotStarts.filter((s) => s >= noon).length;
  if (student.preference === "afternoon") return slotStarts.filter((s) => s < noon).length;
  return 0;
}

/** Soft per-day hour cap so top-up doesn't pile every remaining hour onto one day. */
function dayCapHours(student: Student, settings: ScheduleSettings): number {
  return Math.ceil(settings.weeklyTargetHours / student.daysPerWeek) + settings.slotMinutes / 60;
}

function compareCandidates(a: Candidate, b: Candidate): number {
  return (
    a.score - b.score ||
    a.studentIndex - b.studentIndex ||
    DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
    a.startIdx - b.startIdx ||
    a.len - b.len
  );
}

/**
 * Deterministic, block-based auto-fill: the same students, shifts and settings always
 * produce the same schedule. It plans whole contiguous blocks rather than lone
 * half-hours, and every shift it places is recorded with a plain-language reason.
 *
 * Phase 1 (opening): give each student who needs one a real opening shift first,
 *   since it is the least flexible rule (fixed start time).
 * Phase 2 (coverage): walk the week in time order and, for each under-staffed slot,
 *   add the block that covers the most empty time with the least waste.
 * Phase 3 (top-up): bring everyone toward the weekly target, in the thinnest-covered
 *   time, preferring to extend an existing shift over starting a new one.
 *
 * Hard rules (class, cutoff, lunch, weekly limit, days per week) are never broken.
 */
export function autoFill(
  students: Student[],
  existingAssignments: ShiftBlock[],
  settings: ScheduleSettings,
  options: AutoFillOptions = {},
): AutoFillResult {
  const base = options.replaceAutoFilled ? existingAssignments.filter((a) => a.source === "manual") : existingAssignments;
  const plan = new Plan(settings, base);
  const slots = daySlots(settings);
  const slotHours = settings.slotMinutes / 60;
  const minSlots = Math.ceil(MIN_SHIFT_MINUTES / settings.slotMinutes);
  const maxSlots = Math.max(minSlots, Math.floor(MAX_SHIFT_MINUTES / settings.slotMinutes));
  const explanations: AutoFillExplanation[] = [];

  const runBefore = (student: Student, day: Day, startSlot: Minutes): number => {
    let n = 0;
    while (plan.has(student.id, day, startSlot - (n + 1) * settings.slotMinutes)) n++;
    return n;
  };
  const runAfter = (student: Student, day: Day, endSlot: Minutes): number => {
    let n = 0;
    while (plan.has(student.id, day, endSlot + n * settings.slotMinutes)) n++;
    return n;
  };

  /**
   * Checks one possible block (a student, a day, a starting slot, and a length in
   * slots) and either scores it or rejects it outright. Returns `null` when placing
   * this block would break a hard rule (class conflict, over the weekly hour cap,
   * over the max days-per-week, etc) — those blocks are never considered, no matter
   * how good their score would otherwise be. A lower `score` is a better candidate;
   * the exact scoring weights below are hand-tuned preferences (e.g. "prefer longer
   * shifts over choppy half-hours"), not hard rules.
   */
  function evaluate(
    student: Student,
    studentIndex: number,
    day: Day,
    startIdx: number,
    len: number,
    phase: "coverage" | "top-up",
    extraDayHours = 0,
  ): Candidate | null {
    if (startIdx < 0 || startIdx + len > slots.length) return null;
    const blockSlots = slots.slice(startIdx, startIdx + len);
    for (const s of blockSlots) {
      if (blockedBySlot(student, day, s, settings) || plan.has(student.id, day, s)) return null;
    }
    const addedHours = len * slotHours;
    if (plan.hours(student.id) + addedHours > settings.weeklyTargetHours) return null;
    if (plan.hoursOn(student.id, day) === 0 && plan.daysUsed(student.id) >= student.daysPerWeek) return null;
    if (plan.hoursOn(student.id, day) + addedHours > dayCapHours(student, settings) + extraDayHours) return null;

    let gain = 0;
    let over = 0;
    let staffSum = 0;
    for (const s of blockSlots) {
      const count = plan.staff(day, s);
      staffSum += count;
      if (count < settings.minStaffPerSlot) gain++;
      else over++;
    }

    const before = runBefore(student, day, blockSlots[0]);
    const after = runAfter(student, day, blockSlots[len - 1] + settings.slotMinutes);
    const touches = before > 0 || after > 0;
    const splitShift = plan.hoursOn(student.id, day) > 0 && !touches;
    const mergedRun = len + before + after;

    let score = 0;
    if (phase === "coverage") score += -gain * 10 + over * 4 + plan.hours(student.id) * 0.5;
    else score += (staffSum / len) * 10 - len * 0.5;
    if (len < minSlots && !touches) score += 30;
    if (splitShift) score += 25;
    if (touches) score -= 10;
    if (mergedRun > maxSlots) score += 4 * (mergedRun - maxSlots);
    score += preferenceMismatches(student, blockSlots) * 2;
    return { student, studentIndex, day, startIdx, len, score, gain };
  }

  /** Commits one chosen candidate: adds its slots to the in-progress plan and records the plain-language reason shown to the manager afterward. */
  function place(c: Candidate, phase: AutoFillExplanation["phase"], reason: string): void {
    const start = slots[c.startIdx];
    for (let i = 0; i < c.len; i++) {
      const slot = start + i * settings.slotMinutes;
      plan.add({ id: shiftId(c.student.id, c.day, slot), studentId: c.student.id, day: c.day, start: slot, source: "autofill" });
    }
    explanations.push({
      studentId: c.student.id,
      day: c.day,
      start,
      end: start + c.len * settings.slotMinutes,
      phase,
      reason,
    });
  }

  // ---------------------------------------------------------------------------
  // PHASE 1 — required opening shifts.
  // Some students must open the office (a real contiguous block starting at
  // OPENING_SHIFT_START). This is the least flexible rule — it has one fixed
  // start time — so it goes first, before the more flexible coverage/top-up
  // phases claim those hours for someone else.
  // ---------------------------------------------------------------------------
  const openingShiftUnmet: AutoFillResult["openingShiftUnmet"] = [];
  const openingIdx = slots.indexOf(OPENING_SHIFT_START);
  const requiredOpeningSlots = Math.ceil(MIN_OPENING_SHIFT_MINUTES / settings.slotMinutes);
  for (let studentIndex = 0; studentIndex < students.length; studentIndex++) {
    const student = students[studentIndex];
    if (!student.needsOpeningShift || hasOpeningShift(student.id, plan.blocks, settings)) continue;
    if (openingIdx < 0) {
      openingShiftUnmet.push({
        studentId: student.id,
        reason: `The site opens at ${formatMinutes(settings.openTime)} in this view, so a ${formatMinutes(OPENING_SHIFT_START)} shift can't be placed. Switch to 7:00am open hours.`,
      });
      continue;
    }
    const dayOrder = [...DAYS].sort(
      (a, b) => plan.staff(a, OPENING_SHIFT_START) - plan.staff(b, OPENING_SHIFT_START) || DAYS.indexOf(a) - DAYS.indexOf(b),
    );
    let placed = false;
    for (const day of dayOrder) {
      for (let len = minSlots; len >= requiredOpeningSlots && !placed; len--) {
        const c = evaluate(student, studentIndex, day, openingIdx, len, "coverage");
        if (!c) continue;
        place(c, "opening", `Required opening shift for ${student.name}, starting at ${formatMinutes(OPENING_SHIFT_START)}.`);
        placed = true;
      }
      if (placed) break;
    }
    if (!placed) {
      openingShiftUnmet.push({
        studentId: student.id,
        reason: `No day has ${MIN_OPENING_SHIFT_MINUTES / 60} free hour in a row at ${formatMinutes(OPENING_SHIFT_START)} (classes, cutoff, lunch or hour limits are in the way).`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // PHASE 2 — bring every slot up to the minimum staffing, in time order.
  // Walk the week from Monday 7am forward. Whenever a slot doesn't have enough
  // people yet, try every student/day/length combination that could cover it,
  // score them all, and place the single best one. Repeat until that slot is
  // staffed, then move to the next slot. This is why it's called "greedy": it
  // always takes the best option available right now, without looking ahead.
  // ---------------------------------------------------------------------------
  for (const day of DAYS) {
    for (let i = 0; i < slots.length; i++) {
      while (plan.staff(day, slots[i]) < settings.minStaffPerSlot) {
        let best: Candidate | null = null;
        for (let studentIndex = 0; studentIndex < students.length; studentIndex++) {
          for (let len = 1; len <= maxSlots; len++) {
            for (let startIdx = i - len + 1; startIdx <= i; startIdx++) {
              const c = evaluate(students[studentIndex], studentIndex, day, startIdx, len, "coverage");
              if (c && c.gain > 0 && (best === null || compareCandidates(c, best) < 0)) best = c;
            }
          }
        }
        if (best === null) break;
        const start = slots[best.startIdx];
        place(
          best,
          "coverage",
          `Covers ${best.gain} empty ${best.gain === 1 ? "slot" : "slots"} on ${DAY_LABEL[day]} (${formatRange(start, start + best.len * settings.slotMinutes)}).`,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // PHASE 3 — top everyone up toward the weekly target.
  // Coverage is satisfied by now, but some students may still be short of their
  // weekly hours. For each student, keep adding their best-scoring remaining
  // block (preferring to extend an existing shift and spread hours evenly
  // across days) until they hit their target or nothing more can be placed
  // without breaking a rule — in which case they're reported in `unmet`.
  // ---------------------------------------------------------------------------
  const unmet: AutoFillResult["unmet"] = [];
  for (let studentIndex = 0; studentIndex < students.length; studentIndex++) {
    const student = students[studentIndex];
    let guard = slots.length * DAYS.length;
    const findBest = (extraDayHours: number): Candidate | null => {
      let found: Candidate | null = null;
      for (const day of DAYS) {
        for (let len = 1; len <= maxSlots; len++) {
          for (let startIdx = 0; startIdx + len <= slots.length; startIdx++) {
            const c = evaluate(student, studentIndex, day, startIdx, len, "top-up", extraDayHours);
            if (c && (found === null || compareCandidates(c, found) < 0)) found = c;
          }
        }
      }
      return found;
    };
    while (plan.hours(student.id) < settings.weeklyTargetHours && guard-- > 0) {
      // Prefer an even spread across days; only stretch a day if that is the only way to reach the target.
      const best = findBest(0) ?? findBest(RELAXED_DAY_EXTRA_HOURS);
      if (best === null) break;
      place(best, "top-up", `Adds hours for ${student.name} toward ${settings.weeklyTargetHours} hrs, in the least-covered time.`);
    }
    if (plan.hours(student.id) < settings.weeklyTargetHours) {
      unmet.push({
        studentId: student.id,
        reason: `${student.name}'s classes, cutoff, lunch and days-per-week leave room for only ${plan.hours(student.id)} of ${settings.weeklyTargetHours} hours.`,
      });
    }
  }

  return {
    assignments: normalizeAssignments(plan.blocks),
    unmet,
    openingShiftUnmet,
    explanations,
    deterministic: true,
  };
}
