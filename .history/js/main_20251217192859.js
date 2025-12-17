/* =========================================================
   main.js – UI helpers (Year, Mobile Menu)
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
})();
