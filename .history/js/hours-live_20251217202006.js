/* =========================================================
  Öffnungszeiten: "Heute" + Live-Status (premium, ohne Overlap)
  - Каждый блок отдельно: контейнер [data-hours-root]
  - Строки: любой элемент с [data-weekday], часы в data-hours (или вложенный [data-hours])
  - Badge: DESKTOP = между Day и Time (умное позиционирование), MOBILE = inline
========================================================= */
(function () {
  "use strict";

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

  function fmtDurationShort(mins) {
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
    return map[s.toLowerCase()] || null;
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
        return {
          s, e,
          sTxt: `${pad2(m[1])}:${m[2]}`,
          eTxt: `${pad2(m[3])}:${m[4]}`
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.s - b.s);
  }

  function nextOpenLabel(dayNumber, offsetDays) {
    if (offsetDays === 1) return "morgen";
    return DAY_NAMES[dayNumber];
  }

  function isDesktop() {
    return window.matchMedia && window.matchMedia("(min-width: 640px)").matches;
  }

  function clearBadges(scope) {
    scope.querySelectorAll(".today-badge, .live-badge").forEach((el) => el.remove());
    scope.querySelectorAll("[data-weekday]").forEach((row) => {
      row.classList.remove("bg-sky-50", "ring-1", "ring-sky-200/60");
      // relative не убираем — не мешает и помогает badge'ам
    });
  }

  function setHeuteBadge(dayEl) {
    const b = document.createElement("span");
    b.className =
      "today-badge ml-2 inline-flex items-center whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100";
    b.textContent = "Heute";
    dayEl.appendChild(b);
  }

  function buildBadge(text, variant, titleText) {
    const b = document.createElement("span");
    b.className =
      "live-badge inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 shadow-sm";
    // badge не должен мешать клику по строке/ссылкам
    b.style.pointerEvents = "none";

    if (variant === "open") {
      b.classList.add("bg-emerald-50", "text-emerald-700", "ring-emerald-100");
    } else {
      b.classList.add("bg-white/70", "text-slate-700", "ring-slate-200");
    }
    if (titleText) b.title = titleText;
    b.textContent = text;
    return b;
  }

  // ✅ Premium placement: badge МЕЖДУ dayWrap и timeWrap (без overlap)
  function placeBadgeBetween(row, dayWrap, timeWrap, badge) {
    row.classList.add("relative");
    badge.classList.add(
      "absolute",
      "top-1/2",
      "-translate-y-1/2",
      "z-10"
    );

    // Важно: позиционируем после того, как badge получил размер
    requestAnimationFrame(() => {
      const rowRect = row.getBoundingClientRect();
      const dayRect = dayWrap.getBoundingClientRect();
      const timeRect = timeWrap.getBoundingClientRect();
      const badgeRect = badge.getBoundingClientRect();

      // Центр свободного пространства между колонками
      const gapLeft = dayRect.right;
      const gapRight = timeRect.left;

      // Если места почти нет — fallback inline (лучше, чем перекрывать)
      if (gapRight - gapLeft < 40) {
        badge.classList.remove("absolute", "top-1/2", "-translate-y-1/2", "z-10");
        badge.classList.add("ml-2");
        timeWrap.appendChild(badge);
        return;
      }

      const center = (gapLeft + gapRight) / 2;
      let leftPx = center - badgeRect.width / 2;

      // Clamp: чтобы badge не залезал на day/time
      const padding = 8; // визуальный воздух
      const minLeft = gapLeft + padding;
      const maxLeft = gapRight - padding - badgeRect.width;

      leftPx = Math.max(minLeft, Math.min(maxLeft, leftPx));

      // translate в координаты row
      const leftInRow = leftPx - rowRect.left;

      badge.style.left = `${leftInRow}px`;
    });
  }

  // Rows inside scope:
  function collectRows(scope) {
    return Array.from(scope.querySelectorAll("[data-weekday]"))
      .map((row) => {
        const wd = normalizeWeekday(row.dataset.weekday);
        const hoursEl = row.dataset.hours ? row : row.querySelector("[data-hours]");
        const hours = (row.dataset.hours || (hoursEl && hoursEl.dataset.hours) || "").trim();
        if (!wd) return null;
        return { row, weekday: wd, hours };
      })
      .filter(Boolean);
  }

  // day column + time column
  function getDayAndTimeTargets(row) {
    const children = Array.from(row.children).filter((el) => el && el.nodeType === 1);
    const dayWrap = children[0] || row;
    const timeWrap = children[1] || children[children.length - 1] || row;
    return { dayWrap, timeWrap };
  }

  function initInScope(scope) {
    const items = collectRows(scope);
    if (!items.length) return false;

    function findNextOpen(today, minsNow) {
      for (let off = 1; off <= 7; off++) {
        const d = ((today - 1 + off) % 7) + 1;
        const it = items.find((x) => x.weekday === d);
        const rr = it ? parseRanges(it.hours) : [];
        if (rr.length) return { day: d, range: rr[0], offsetDays: off };
      }
      return null;
    }

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

      // helper to show badge (desktop between, mobile inline)
      function showBadge(text, variant, titleText) {
        const badge = buildBadge(text, variant, titleText);
        if (!isDesktop()) {
          badge.classList.add("ml-2");
          timeWrap.appendChild(badge);
          return;
        }
        row.appendChild(badge);
        placeBadgeBetween(row, dayWrap, timeWrap, badge);
      }

      // Сегодня полностью закрыто
      if (!ranges.length) {
        const next = findNextOpen(today, minsNow);
        if (next) {
          const minsTo = (1440 - minsNow) + (next.offsetDays - 1) * 1440 + next.range.s;
          const label = nextOpenLabel(next.day, next.offsetDays);
          showBadge(`öffnet ${label} ${next.range.sTxt}`, "closed", `In ${fmtDuration(minsTo)}`);
        } else {
          showBadge("geschlossen", "closed");
        }
        return;
      }

      // Сейчас открыто
      const openRange = ranges.find((r) => minsNow >= r.s && minsNow < r.e);
      if (openRange) {
        showBadge(`noch ${fmtDurationShort(openRange.e - minsNow)}`, "open", `Geöffnet · bis ${openRange.eTxt}`);
        return;
      }

      // Откроется сегодня позже
      const nextToday = ranges.find((r) => minsNow < r.s);
      if (nextToday) {
        showBadge(`öffnet ${nextToday.sTxt}`, "closed", `In ${fmtDuration(nextToday.s - minsNow)}`);
        return;
      }

      // Следующее открытие в другой день
      const next = findNextOpen(today, minsNow);
      if (next) {
        const minsTo = (1440 - minsNow) + (next.offsetDays - 1) * 1440 + next.range.s;
        const label = nextOpenLabel(next.day, next.offsetDays);
        showBadge(`öffnet ${label} ${next.range.sTxt}`, "closed", `In ${fmtDuration(minsTo)}`);
      } else {
        showBadge("geschlossen", "closed");
      }
    }

    render();
    const iv = setInterval(render, 60 * 1000);

    // при ресайзе пересчитать позицию (дебаунс)
    let t = null;
    window.addEventListener("resize", () => {
      clearTimeout(t);
      t = setTimeout(render, 120);
    }, { passive: true });

    log("initialized:", scope, "interval:", iv);
    return true;
  }

  function boot() {
    // ✅ Каждый блок отдельно
    const roots = Array.from(document.querySelectorAll("[data-hours-root]"));

    // fallback (если забыл data-hours-root)
    if (!roots.length) {
      const a = document.getElementById("hours-list-kontakt");
      const b = document.getElementById("hours-list-maria");
      if (a) roots.push(a);
      if (b) roots.push(b);
    }

    if (!roots.length) {
      console.warn("[hours-live] Нет контейнеров [data-hours-root]. Добавь data-hours-root к каждому блоку Öffnungszeiten.");
      return;
    }

    roots.forEach(initInScope);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
