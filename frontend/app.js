const dolphinUi = (() => {
  function initTabs(root = document) {
    root.querySelectorAll("[data-tabs]").forEach((tabsRoot) => {
      const tabs = [...tabsRoot.querySelectorAll("[role='tab']")];
      const panels = [...tabsRoot.querySelectorAll("[role='tabpanel']")];
      tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          tabs.forEach((item) => item.setAttribute("aria-selected", item === tab ? "true" : "false"));
          panels.forEach((panel) => {
            panel.hidden = panel.id !== tab.getAttribute("aria-controls");
          });
        });
      });
    });
  }

  function initCopy(root = document) {
    root.querySelectorAll("[data-copy]").forEach((button) => {
      button.addEventListener("click", async () => {
        const target = document.querySelector(button.getAttribute("data-copy"));
        const text = target ? target.textContent.trim() : button.getAttribute("data-copy-text") || "";
        try {
          await navigator.clipboard.writeText(text);
          button.textContent = "COPIED";
        } catch {
          button.textContent = "COPY";
        }
        window.setTimeout(() => {
          button.textContent = button.getAttribute("data-label") || "COPY";
        }, 1200);
      });
    });
  }

  function initSwitches(root = document) {
    root.querySelectorAll(".switch").forEach((item) => {
      item.addEventListener("click", () => item.classList.toggle("active"));
    });
  }

  function initFilters(root = document) {
    const filter = root.querySelector("[data-filter]");
    if (!filter) return;
    filter.addEventListener("input", () => {
      const value = filter.value.toLowerCase();
      root.querySelectorAll("[data-filter-row]").forEach((row) => {
        row.hidden = !row.textContent.toLowerCase().includes(value);
      });
    });
  }

  function initWalletModal(root = document) {
    const open = root.querySelector("[data-open-wallet]");
    const modal = root.querySelector("[data-wallet-modal]");
    const close = root.querySelector("[data-close-wallet]");
    if (!open || !modal) return;
    open.addEventListener("click", () => {
      modal.hidden = false;
      modal.querySelector("button, a")?.focus();
    });
    close?.addEventListener("click", () => {
      modal.hidden = true;
      open.focus();
    });
  }

  function initPlayground(root = document) {
    const chain = root.querySelector("[data-chain]");
    const mode = root.querySelector("[data-auth-mode]");
    const storage = root.querySelector("[data-storage]");
    const preview = root.querySelector("[data-preview]");
    if (!chain || !mode || !storage || !preview) return;
    const render = () => {
      preview.textContent = `DolphinProvider configured for ${chain.value}, ${mode.value} auth, ${storage.value} token storage.`;
    };
    [chain, mode, storage].forEach((field) => field.addEventListener("change", render));
    render();
  }

  function init() {
    initTabs();
    initCopy();
    initSwitches();
    initFilters();
    initWalletModal();
    initPlayground();
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", dolphinUi.init);
