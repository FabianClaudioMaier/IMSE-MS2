export function initView({ actions }) {
  const viewButtons = document.querySelectorAll("[data-view]");
  const views = {
    home: document.getElementById("view-home"),
    usecase1: document.getElementById("view-usecase1"),
    usecase2: document.getElementById("view-usecase2"),
    explore: document.getElementById("view-explore"),
    "uc1-report": document.getElementById("view-uc1-report"),
    "uc2-report": document.getElementById("view-uc2-report"),
  };

  function setView(viewName) {
    Object.entries(views).forEach(([name, view]) => {
      if (!view) {
        return;
      }
      view.classList.toggle("active", name === viewName);
    });

    viewButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.view === viewName);
    });

    if (viewName === "usecase2") {
      actions.ensureUseCase2Customers?.();
    }
    if (viewName === "usecase1") {
      actions.ensureUc1Customers?.();
    }
  }

  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
    });
  });

  const homeUc1Button = document.getElementById("home-uc1");
  const homeUc2Button = document.getElementById("home-uc2");

  if (homeUc1Button) {
    homeUc1Button.addEventListener("click", () => {
      setView("usecase1");
    });
  }

  if (homeUc2Button) {
    homeUc2Button.addEventListener("click", () => {
      setView("usecase2");
    });
  }
}
