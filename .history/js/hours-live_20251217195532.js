/* =========================================================
  Öffnungszeiten: "Heute" + Live-Status (öffnet/schließt in …)
  Универсально для BERND и MARIA:
  Ищет в контейнере любые строки с [data-weekday][data-hours]
========================================================= */
(function () {
  "use strict";

  // защита от двойного запуска (если вдруг подключишь дважды)
  if (window.__LIVE_HOURS_INIT__) return;
  window.__LIVE_HOURS_INIT__ = true;

  const DAY_NAMES = {
    1: "Montag",
    2: "Dienstag",
    3: "Mittwoch",
    4: "Donnerstag",
    5: "Freitag",
    6: "Samstag",
    7: "Sonntag",
  };

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

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

  // "08:00-12:00,14:00-16:00" -> [{s,e,sTxt,eTxt}, ...]
  function parseRanges(str) {
    if (!str) return [];
    return str
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((r) => {
        // поддержка: "-" и "–" и "—"
        const m = r.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
        if (!m) return null;
        const s = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        const e = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
        return { s, e, sTxt: `${pad2(m[1])}:${m[2]}`, eTxt: `${pad2(m[3])}:${m[4]}` };
      })
      .filter(Boolean)
      .sort((a, b) => a.s - b.s);
  }

  function getWeekdayMo1() {
    const jsDay = new Date().getDay(); // So=0..Sa=6
    return jsDay === 0 ? 7 : jsDay;    // Mo=1..So=7
  }

  function clearBadges(root) {
    root.querySelectorAll(".today-badge, .live-badge").forEach((el) => el.remove());
    root.querySelectorAll("[data-weekday]").forEach((row) => {
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
    if (variant === "open") {
      b.classList.add("bg-emerald-50", "text-emerald-700", "ring-emerald-100");
    } else {
      b.classList.add("bg-sky-50", "text-sky-800", "ring-sky-100");
    }
    b.textContent = text;
    targetEl.appendChild(b);
  }

  function initLiveHours(root) {
    if (!root) return;

    // строки часов (универсально)
    const rows = Array.from(root.querySelectorAll("[data-weekday][data-hours]"));
    if (!rows.length) return;

    function render() {
      clearBadges(root);

      const today = getWeekdayMo1();
      const todayRow = rows.find((r) => String(r.dataset.weekday) === String(today));
      if (!todayRow) return;

      todayRow.classList.add("bg-sky-50", "ring-1", "ring-sky-200/60");

      // Берём первые две колонки как "день" и "время" максимально надёжно:
      const cols = Array.from(todayRow.children).filter((el) => el && el.nodeType === 1);
      const dayWrap = cols[0] || todayRow;
      const timeWrap = cols[1] || cols[cols.length - 1] || todayRow;

      setHeuteBadge(dayWrap);

      const minsNow = nowMinutes();
      const ranges = parseRanges(todayRow.dataset.hours || "");

      function findNextOpen() {
        for (let off = 1; off <= 7; off++) {
          const d = ((today - 1 + off) % 7) + 1;
          const row = rows.find((r) => String(r.dataset.weekday) === String(d));
          const rr = row ? parseRanges(row.dataset.hours || "") : [];
          if (rr.length) return { day: d, range: rr[0], offsetDays: off };
        }
        return null;
      }

      // Сегодня полностью закрыто
      if (!ranges.length) {
        const next = findNextOpen();
        if (next) {
          const minsTo =
            (1440 - minsNow) + (next.offsetDays - 1) * 1440 + next.range.s;
          setLiveBadge(
            timeWrap,
            `Geschlossen · öffnet ${DAY_NAMES[next.day]} ${next.range.sTxt} (in ${fmtDuration(minsTo)})`,
            "closed"
          );
        } else {
          setLiveBadge(timeWrap, "Geschlossen", "closed");
        }
        return;
      }

      // Сейчас открыто?
      const openRange = ranges.find((r) => minsNow >= r.s && minsNow < r.e);
      if (openRange) {
        setLiveBadge(
          timeWrap,
          `Geöffnet · schließt in ${fmtDuration(openRange.e - minsNow)}`,
          "open"
        );
        return;
      }

      // Следующее открытие сегодня
      const nextToday = ranges.find((r) => minsNow < r.s);
      if (nextToday) {
        setLiveBadge(
          timeWrap,
          `Geschlossen · öffnet ${nextToday.sTxt} (in ${fmtDuration(nextToday.s - minsNow)})`,
          "closed"
        );
        return;
      }

      // Иначе — следующее открытие в другой день
      const next = findNextOpen();
      if (next) {
        const minsTo =
          (1440 - minsNow) + (next.offsetDays - 1) * 1440 + next.range.s;
        setLiveBadge(
          timeWrap,
          `Geschlossen · öffnet ${DAY_NAMES[next.day]} ${next.range.sTxt} (in ${fmtDuration(minsTo)})`,
          "closed"
        );
      } else {
        setLiveBadge(timeWrap, "Geschlossen", "closed");
      }
    }

    render();
    setInterval(render, 60 * 1000);
  }

  // Старт только когда DOM готов
  function boot() {
    // На каждой странице будет существовать только “свой” контейнер — это ок.
    const roots = [
      document.getElementById("hours-list-kontakt"),
      document.getElementById("hours-list-maria"),
    ].filter(Boolean);

    roots.forEach(initLiveHours);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
