/* =========================================================
    main.js – UI helpers (Year, Mobile Menu, Today Highlight)
   ========================================================= */

(function () {
    // Footer year
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Mobile menu toggle
    const btn = document.getElementById("menuBtn");
    const menu = document.getElementById("mobileMenu");

    if (btn && menu) {
        btn.addEventListener("click", () => {
            const isOpen = !menu.classList.contains("hidden");
            menu.classList.toggle("hidden");
            btn.setAttribute("aria-expanded", String(!isOpen));
        });

        menu.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", () => {
                menu.classList.add("hidden");
                btn.setAttribute("aria-expanded", "false");
            });
        });
    }

    // Today highlight (simple version)
    (function () {
        const jsDay = new Date().getDay();      // So=0..Sa=6
        const weekday = jsDay === 0 ? 7 : jsDay; // Mo=1..So=7

        const rows = document.querySelectorAll(".hours-row[data-weekday]");
        if (!rows.length) return;

        rows.forEach((row) => {
            row.classList.remove("bg-sky-50", "ring-1", "ring-sky-200/60");
            const badge = row.querySelector(".today-badge");
            if (badge) badge.remove();
        });

        const todayRow = document.querySelector('.hours-row[data-weekday="' + weekday + '"]');
        if (!todayRow) return;

        todayRow.classList.add("bg-sky-50", "ring-1", "ring-sky-200/60");

        const dayLabel = todayRow.querySelector("span");
        if (dayLabel) {
            const b = document.createElement("span");
            b.className =
                "today-badge ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100";
            b.textContent = "Heute";
            dayLabel.insertAdjacentElement("afterend", b);
        }
    })();
})();
