/*
 * Runs BEFORE the first screen is drawn, so the page opens in the right colors with no flash.
 *
 * Syncro opens in the light (white) look unless the person has chosen dark or auto themselves. The app
 * (src/hooks/useTheme.ts, function readSavedTheme) works out the same answer; this tiny copy exists because the
 * website's security policy does not allow scripts written inside the page, only script FILES like this one.
 * `src/test/theme-default.test.tsx` runs both and checks they always agree.
 */
(function () {
  try {
    var saved = window.localStorage.getItem("shiftfit:theme");
    var chosen = window.localStorage.getItem("shiftfit:themeChosen") === "1";
    // A saved "system" only counts if the person picked it (older versions saved it without anyone choosing).
    var theme = saved === "light" || saved === "dark" ? saved : saved === "system" && chosen ? "system" : "light";
    // "system" means follow the device: leave the marker off and the stylesheet does that.
    if (theme !== "system") document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
