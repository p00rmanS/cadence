import { describe, expect, it } from "vitest";
import { todayStamp } from "../lib/download";

describe("todayStamp", () => {
  it("uses the local calendar date, not UTC", () => {
    // 11:30pm on Sep 19 in the local timezone is already Sep 20 in UTC for anyone west of Greenwich.
    expect(todayStamp(new Date(2026, 8, 19, 23, 30))).toBe("2026-09-19");
    expect(todayStamp(new Date(2026, 0, 5, 0, 5))).toBe("2026-01-05");
  });

  it("pads single digits", () => {
    expect(todayStamp(new Date(2027, 2, 4, 12, 0))).toBe("2027-03-04");
  });
});
