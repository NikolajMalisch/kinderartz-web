/* =========================================================
  Öffnungszeiten: "Heute" + Live-Status (premium, ohne Verwirrung)
  ---------------------------------------------------------
  ✅ Kein "geschlossen" als Badge-Text (vermeidet Missverständnisse).
  ✅ Geöffnet:  Badge "bis HH:MM" (grün) + Tooltip "noch ..."
  ✅ Geschlossen: Badge "öffnet ..." + Tooltip "in ..."
  ✅ Funktioniert getrennt für Bernd & Maria:
     -> Jeder Stunden-Block braucht: [data-hours-root]
  ✅ Reihen/Zeilen:
     -> Element mit [data-weekday]
     -> Stunden in data-hours (oder ein Kind-Element mit [data-hours])
  ✅ Badge-Placement:
     -> Desktop: zwischen Day-Spalte und Time-Spalte (kein Overlap)
     -> Mobile: inline (kein Überdecken)
========================================================= */
(function () {
  "use strict";

  // Debug-Logs bei Bedarf aktivieren
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

  function log(...a) {
    if (DEBUG) console.log("[hours-live]", ...a);
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  // Dauer als Klartext (Tooltip: "in 2 Std 15 Min")
  function fmtDuration(mins) {
    const m = Math.max(0, Math.round(mins));
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h <= 0) return `${r} Min`;
    if (r === 0) return `${h} Std`;
    return `${h} Std ${r} Min`;
  }

  // Kurzformat (UI: "noch 45 Min" / "noch 2 Std")
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

  // JS: Sonntag=0..Samstag=6 -> wir brauchen Montag=1..Sonntag=7
  function getWeekdayMo1() {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 7 : jsDay;
  }

  // data-weekday akzeptiert: "1..7" oder "Mo/Montag/Di/..."
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
        // Unterstützt "-" und "–" und "—"
        const m = r.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
        if (!m) return null;
        const s = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        const e = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
        return {
          s,
          e,
          sTxt: `${pad2(m[1])}:${m[2]}`,
          eTxt: `${pad2(m[3])}:${m[4]}`,
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

  // Alte Badges entfernen + Today-Highlight resetten
  function clearBadges(scope) {
    scope.querySelectorAll(".today-badge, .live-badge").forEach((el) => el.remove());
    scope.querySelectorAll("[data-weekday]").forEach((row) => {
      row.classList.remove("bg-sky-50", "ring-1", "ring-sky-200/60");
    });
  }

  // "Heute" Badge im Day-Bereich
  function setHeuteBadge(dayEl) {
    const b = document.createElement("span");
    b.className =
      "today-badge ml-2 inline-flex items-center whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100";
    b.textContent = "Heute";
    dayEl.appendChild(b);
  }

  // Badge-Element bauen (premium, ruhig)
  function buildBadge(text, variant, titleText) {
    const b = document.createElement("span");
    b.className =
      "live-badge inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 shadow-sm";
    // Badge soll keine Klicks abfangen
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

  // Badge zwischen Day- und Time-Spalte positionieren (ohne Overlap)
  function placeBadgeBetween(row, dayWrap, timeWrap, badge) {
    row.classList.add("relative");
    badge.classList.add("absolute", "top-1/2", "-translate-y-1/2", "z-10");

    // Nach Layout-Pass positionieren (Badge hat dann echte Breite)
    requestAnimationFrame(() => {
      const rowRect = row.getBoundingClientRect();
      const dayRect = dayWrap.getBoundingClientRect();
      const timeRect = timeWrap.getBoundingClientRect();
      const badgeRect = badge.getBoundingClientRect();

      // Freier Bereich zwischen Day und Time
      const gapLeft = dayRect.right;
      const gapRight = timeRect.left;

      // Zu wenig Platz? -> fallback inline (besser als überdecken)
      if (gapRight - gapLeft < 40) {
        badge.classList.remove("absolute", "top-1/2", "-translate-y-1/2", "z-10");
        badge.classList.add("ml-2");
        timeWrap.appendChild(badge);
        return;
      }

      // Zentrieren im freien Bereich
      const center = (gapLeft + gapRight) / 2;
      let leftPx = center - badgeRect.width / 2;

      // Clamp: nicht in Day/Time reinlaufen
      const padding = 8;
      const minLeft = gapLeft + padding;
      const maxLeft = gapRight - padding - badgeRect.width;
      leftPx = Math.max(minLeft, Math.min(maxLeft, leftPx));

      // Auf Row-Koordinaten umrechnen
      badge.style.left = `${leftPx - rowRect.left}px`;
    });
  }

  // Rows im Block einsammeln:
  // - [data-weekday] auf Row
  // - hours: row.dataset.hours oder child [data-hours]
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

  // Day- und Time-Ziel finden (1. & 2. Child sind ideal)
  function getDayAndTimeTargets(row) {
    const children = Array.from(row.children).filter((el) => el && el.nodeType === 1);
    const dayWrap = children[0] || row;
    const timeWrap = children[1] || children[children.length - 1] || row;
    return { dayWrap, timeWrap };
  }

  function initInScope(scope) {
    const items = collectRows(scope);
    if (!items.length) return false;

    // Nächste Öffnung suchen (in den nächsten 7 Tagen)
    function findNextOpen(today, minsNow) {
      for (let off = 0; off <= 7; off++) {
        const d = ((today - 1 + off) % 7) + 1;
        const it = items.find((x) => x.weekday === d);
        const rr = it ? parseRanges(it.hours) : [];
        if (!rr.length) continue;

        // Wenn off=0 (heute): die nächste Range nach "jetzt" nehmen
        if (off === 0) {
          const nextToday = rr.find((r) => minsNow < r.s);
          if (nextToday) return { day: d, range: nextToday, offsetDays: 0 };
        } else {
          // anderer Tag: erste Range
          return { day: d, range: rr[0], offsetDays: off };
        }
      }
      return null;
    }

    function render() {
      clearBadges(scope);

      const today = getWeekdayMo1();
      const minsNow = nowMinutes();

      const todayItem = items.find((x) => x.weekday === today);
      if (!todayItem) return;

      const { row, hours } = todayItem;
      row.classList.add("bg-sky-50", "ring-1", "ring-sky-200/60");

      const { dayWrap, timeWrap } = getDayAndTimeTargets(row);
      setHeuteBadge(dayWrap);

      // Helper: Badge anzeigen (Desktop: zwischen, Mobile: inline)
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

      const ranges = parseRanges(hours);

      // 1) Если сейчас открыто -> показываем "bis HH:MM"
      const openRange = ranges.find((r) => minsNow >= r.s && minsNow < r.e);
      if (openRange) {
        // UI: "bis 12:00" (очень ясно)
        // Tooltip: "noch 2 Std 10 Min"
        showBadge(
          `bis ${openRange.eTxt}`,
          "open",
          `Noch ${fmtDurationShort(openRange.e - minsNow)}`
        );
        return;
      }

      // 2) Если сейчас закрыто -> всегда показываем "öffnet ..."
      //    (даже если сегодня уже не будет)
      const next = findNextOpen(today, minsNow);

      if (next) {
        const label =
          next.offsetDays === 0
            ? "heute"
            : nextOpenLabel(next.day, next.offsetDays);

        const minsTo =
          next.offsetDays === 0
            ? (next.range.s - minsNow)
            : (1440 - minsNow) + (next.offsetDays - 1) * 1440 + next.range.s;

        // UI: "öffnet morgen 09:00" / "öffnet heute 14:00" / "öffnet Montag 09:00"
        // Tooltip: "In 5 Std 20 Min"
        showBadge(
          `öffnet ${label} ${next.range.sTxt}`,
          "closed",
          `In ${fmtDuration(minsTo)}`
        );
        return;
      }

      // 3) Если вообще нет часов в этом блоке -> нейтрально (но без "geschlossen")
      showBadge("Termine nach Vereinbarung", "closed");
    }

    render();
    setInterval(render, 60 * 1000);

    // Пересчитать позицию при ресайзе
    let t = null;
    window.addEventListener("resize", () => {
      clearTimeout(t);
      t = setTimeout(render, 120);
    }, { passive: true });

    log("initialized:", scope);
    return true;
  }

  function boot() {
    // Каждый блок отдельно (важно для Bernd vs Maria)
    const roots = Array.from(document.querySelectorAll("[data-hours-root]"));

    // fallback по id, если забудешь data-hours-root
    if (!roots.length) {
      const a = document.getElementById("hours-list-kontakt");
      const b = document.getElementById("hours-list-maria");
      if (a) roots.push(a);
      if (b) roots.push(b);
    }

    if (!roots.length) {
      console.warn("[hours-live] Keine [data-hours-root] Container gefunden. Bitte data-hours-root am Stundenblock setzen.");
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
