export function initSeed({ actions }) {
  const generateButton = document.getElementById("generate");
  const generateHint = document.getElementById("generate-hint");
  const generateLabel = generateButton ? generateButton.textContent : "";

  function setGenerateState({ disabled, label, hint }) {
    if (!generateButton) {
      return;
    }
    generateButton.disabled = disabled;
    if (label) {
      generateButton.textContent = label;
    }
    if (generateHint && hint) {
      generateHint.textContent = hint;
    }
  }

  async function loadSeedStatus() {
    if (!generateButton) {
      return;
    }

    try {
      const response = await fetch("/api/seed-status");
      if (!response.ok) {
        throw new Error("Failed to check seed status");
      }
      const data = await response.json();
      if (data.seeded) {
        setGenerateState({
          disabled: true,
          label: "Data Generated",
          hint: "Test data already generated.",
        });
      }
    } catch (err) {
      actions.setStatus?.("Failed to check seed status.", true);
    }
  }

  async function generateData() {
    setGenerateState({
      disabled: true,
      label: "Generating...",
      hint: "Generating sample data. This may take a moment.",
    });
    actions.setStatus?.("Generating sample data...");

    try {
      const response = await fetch("/api/generate", { method: "POST" });
      if (response.status === 409) {
        setGenerateState({
          disabled: true,
          label: "Data Generated",
          hint: "Test data already generated.",
        });
        actions.setStatus?.("Data already generated.");
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to generate data");
      }

      setGenerateState({
        disabled: true,
        label: "Data Generated",
        hint: "Test data already generated.",
      });

      const currentTable = actions.getCurrentTable?.();
      if (currentTable && actions.loadTable) {
        await actions.loadTable(currentTable);
      }
      actions.setStatus?.("Sample data generated.");
      actions.loadUseCaseCustomers?.();
    } catch (err) {
      setGenerateState({
        disabled: false,
        label: generateLabel,
        hint: "One-time action. Inserts up to 10 rows per table.",
      });
      actions.setStatus?.("Failed to generate data.", true);
    }
  }

  if (generateButton) {
    generateButton.addEventListener("click", () => {
      generateData();
    });
  }

  actions.loadSeedStatus = loadSeedStatus;
}
