/* =========================================================
    Öffnungszeiten: Premium-Minimal
    - Nur "Heute" markieren (Highlight + kleines Badge)
    - Kein Live-Status, kein "geschlossen", kein "öffnet ..."
    - Für Bernd & Maria getrennt:
    -> Jeder Stunden-Block braucht: [data-hours-root]
    - Zeilen brauchen: [data-weekday] (1..7 oder Mo/Montag/Di/...)
========================================================= */
(function () {
    "use strict";

    const DAY_NAMES_MAP = {
        mo: 1, montag: 1,
        di: 2, dienstag: 2,
        mi: 3, mittwoch: 3,
        do: 4, donnerstag: 4,
        fr: 5, freitag: 5,
        sa: 6, samstag: 6,
        so: 7, sonntag: 7,
    };

    // JS: Sonntag=0..Samstag=6 -> Montag=1..Sonntag=7
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
        return DAY_NAMES_MAP[s.toLowerCase()] || null;
    }

    // Alte "Heute"-Badges entfernen + Highlight reset
    function clearHeute(scope) {
        scope.querySelectorAll(".today-badge").forEach((el) => el.remove());
        scope.querySelectorAll("[data-weekday]").forEach((row) => {
            row.classList.remove("bg-sky-50", "ring-1", "ring-sky-200/60");
        });
    }

    // Kleines "Heute" Badge im Day-Bereich
    function addHeuteBadge(dayEl) {
        const b = document.createElement("span");
        b.className =
            "today-badge ml-2 inline-flex items-center whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100";
        b.textContent = "Heute";
        dayEl.appendChild(b);
    }

    // Day-Spalte finden
    function getDayWrap(row) {
        // Idealfall: 1. Child ist die Day-Spalte
        const children = Array.from(row.children).filter((el) => el && el.nodeType === 1);
        return children[0] || row;
    }

    function initBlock(scope) {
        const rows = Array.from(scope.querySelectorAll("[data-weekday]"))
            .map((row) => ({ row, wd: normalizeWeekday(row.dataset.weekday) }))
            .filter((x) => x.wd);

        if (!rows.length) return;

        function render() {
            clearHeute(scope);

            const today = getWeekdayMo1();
            const todayRow = rows.find((x) => x.wd === today);
            if (!todayRow) return;

            // Premium Highlight (ruhig)
            todayRow.row.classList.add("bg-sky-50", "ring-1", "ring-sky-200/60");

            const dayWrap = getDayWrap(todayRow.row);
            addHeuteBadge(dayWrap);
        }

        render();

        // Optional: um Mitternacht automatisch neu setzen (einmal pro Stunde reicht)
        setInterval(render, 60 * 60 * 1000);
    }

    function boot() {
        // ✅ Jeder Stundenblock separat
        const roots = Array.from(document.querySelectorAll("[data-hours-root]"));

        // Fallback: falls data-hours-root vergessen wurde
        if (!roots.length) {
            const a = document.getElementById("hours-list-kontakt");
            const b = document.getElementById("hours-list-maria");
            if (a) roots.push(a);
            if (b) roots.push(b);
        }

        if (!roots.length) return;
        roots.forEach(initBlock);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
