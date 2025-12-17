/* =========================================================
  Öffnungszeiten: "Heute" + Live-Status (öffnet/schließt in …)
  - Auto-find rows with data-weekday + data-hours (even if nested)
  - Works on both pages (Bernd + Maria)
========================================================= */
(function () {
  "use strict";

  // Optional debug (true = покажет в консоли, что найдено)
  const DEBUG = false;

  const DAY_NAMES = {
    1: "Montag",
    2: "Dienstag",
    3: "Mittwoch",
    4: "Donnerstag",
    5: "Freitag",
    6: "Samstag",
    7: "Sonntag",
  };

  function log(...a) { if (DEBUG) console.log("[hours-live]", ...a); }

  function pad2(n) { return String(n).padStart(2, "0"); }

  function fmtDuration(mins) {
    const m = Math.max(0, Math.round(mins));
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h <= 0) return `${r} Min`;
    if (r === 0) return `${h} Std`;
    return `${h} Std ${r} Min`;
  }

  function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function getWeekdayMo1() {
    const jsDay = new Date().getDay(); // So=0..Sa=6
    return jsDay === 0 ? 7 : jsDay;    // Mo=1..So=7
  }

  // Normalize weekday: "1".."7" OR "Mo"/"Montag"/"Di"/...
  function normalizeWeekday(v) {
    if (v == null) return null;
    const s = String(v).trim();
    const n = parseInt(s, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 7) return n;

    const map = {
      mo: 1, montag: 1,
      di: 2, dienstag: 2,
      mi: 3, mittwoch: 3,
      do: 4, donnerstag: 4,
      fr: 5, freitag: 5,
      sa: 6, samstag: 6,
      so: 7, sonntag: 7,
    };
    const key = s.toLowerCase();
    return map[key] || null;
  }

  // "08:00-12:00,14:00-16:00" -> [{s,e,sTxt,eTxt}, ...]
  function parseRanges(str) {
    if (!str) return [];
    return str
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((r) => {
        const m = r.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
        if (!m) return null;
        const s = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        const e = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
        return { s, e, sTxt: `${pad2(m[1])}:${m[2]}`, eTxt: `${pad2(m[3])}:${m[4]}` };
      })
      .filter(Boolean)
      .sort((a, b) => a.s - b.s);
  }

  function clearBadges(scope) {
    scope.querySelectorAll(".today-badge, .live-badge").forEach((el) => el.remove());
    scope.querySelectorAll("[data-weekday]").forEach((row) => {
      row.classList.remove("bg-sky-50", "ring-1", "ring-sky-200/60");
    });
  }

  function setHeuteBadge(dayEl) {
    const b = document.createElement("span");
    b.className =
      "today-badge ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100";
    b.textContent = "Heute";
    dayEl.appendChild(b);
  }

  function setLiveBadge(targetEl, text, variant) {
    const b = document.createElement("span");
    b.className =
      "live-badge ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1";
    if (variant === "open") b.classList.add("bg-emerald-50", "text-emerald-700", "ring-emerald-100");
    else b.classList.add("bg-sky-50", "text-sky-800", "ring-sky-100");
    b.textContent = text;
    targetEl.appendChild(b);
  }

  // Find row elements (robust):
  // - row = element with data-weekday
  // - hours can be on row itself OR inside a child with [data-hours]
  function collectRows(scope) {
    const rows = Array.from(scope.querySelectorAll("[data-weekday]"))
      .map((row) => {
        const wd = normalizeWeekday(row.dataset.weekday);
        const hoursEl = row.dataset.hours ? row : row.querySelector("[data-hours]");
        const hours = (row.dataset.hours || (hoursEl && hoursEl.dataset.hours) || "").trim();
        if (!wd) return null;
        return { row, weekday: wd, hours };
      })
      .filter(Boolean);

    // unique by weekday, keep first occurrence
    const seen = new Set();
    const out = [];
    for (const x of rows) {
      const key = `${x.weekday}-${x.row.closest("section,div,ul,ol")?.id || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(x);
    }
    return out;
  }

  // Pick columns:
  // try: first 2 direct children, else fallback to row itself
  function getDayAndTimeTargets(row) {
    const children = Array.from(row.children).filter((el) => el && el.nodeType === 1);
    const dayWrap = children[0] || row;
    const timeWrap = children[1] || children[children.length - 1] || row;
    return { dayWrap, timeWrap };
  }

  function initInScope(scope) {
    const items = collectRows(scope);
    if (!items.length) return false;

    function render() {
      clearBadges(scope);

      const today = getWeekdayMo1();
      const todayItem = items.find((x) => x.weekday === today);
      if (!todayItem) return;

      const { row, hours } = todayItem;
      row.classList.add("bg-sky-50", "ring-1", "ring-sky-200/60");

      const { dayWrap, timeWrap } = getDayAndTimeTargets(row);
      setHeuteBadge(dayWrap);

      const minsNow = nowMinutes();
      const ranges = parseRanges(hours);

      function findNextOpen() {
        for (let off = 1; off <= 7; off++) {
          const d = ((today - 1 + off) % 7) + 1;
          const it = items.find((x) => x.weekday === d);
          const rr = it ? parseRanges(it.hours) : [];
          if (rr.length) return { day: d, range: rr[0], offsetDays: off };
        }
        return null;
      }

      if (!ranges.length) {
        const next = findNextOpen();
        if (next) {
          const minsTo = (1440 - minsNow) + (next.offsetDays - 1) * 1440 + next.range.s;
          setLiveBadge(timeWrap, `Geschlossen · öffnet ${DAY_NAMES[next.day]} ${next.range.sTxt} (in ${fmtDuration(minsTo)})`, "closed");
        } else {
          setLiveBadge(timeWrap, "Geschlossen", "closed");
        }
        return;
      }

      const openRange = ranges.find((r) => minsNow >= r.s && minsNow < r.e);
      if (openRange) {
        setLiveBadge(timeWrap, `Geöffnet · schließt in ${fmtDuration(openRange.e - minsNow)}`, "open");
        return;
      }

      const nextToday = ranges.find((r) => minsNow < r.s);
      if (nextToday) {
        setLiveBadge(timeWrap, `Geschlossen · öffnet ${nextToday.sTxt} (in ${fmtDuration(nextToday.s - minsNow)})`, "closed");
        return;
      }

      const next = findNextOpen();
      if (next) {
        const minsTo = (1440 - minsNow) + (next.offsetDays - 1) * 1440 + next.range.s;
        setLiveBadge(timeWrap, `Geschlossen · öffnet ${DAY_NAMES[next.day]} ${next.range.sTxt} (in ${fmtDuration(minsTo)})`, "closed");
      } else {
        setLiveBadge(timeWrap, "Geschlossen", "closed");
      }
    }

    render();
    setInterval(render, 60 * 1000);
    log("initialized in scope:", scope);
    return true;
  }

  function boot() {
    // 1) если есть конкретные контейнеры — используем их
    const roots = [
      document.getElementById("hours-list-kontakt"),
      document.getElementById("hours-list-maria"),
    ].filter(Boolean);

    let ok = false;
    roots.forEach((r) => { ok = initInScope(r) || ok; });

    // 2) если контейнеров нет — пробуем на всей странице (часто это и есть причина)
    if (!ok) {
      ok = initInScope(document);
    }

    if (!ok) {
      // важный сигнал: атрибутов нет/другие имена
      console.warn("[hours-live] Не найдено ни одной строки с data-weekday (+ data-hours). Проверь разметку.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
