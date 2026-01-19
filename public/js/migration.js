export function initMigration({ actions, state }) {
  const migrateButton = document.getElementById("migrate-nosql");
  const migrateHint = document.getElementById("migrate-hint");
  const homeMigrateStatus = document.getElementById("home-migrate-status");
  let migrationComplete = false;

  function setMigrateStatus(message, isError = false) {
    if (homeMigrateStatus) {
      homeMigrateStatus.textContent = message;
      homeMigrateStatus.classList.toggle("error", isError);
    }
    actions.setStatus?.(message, isError);
  }

  async function migrateNoSql() {
    if (!migrateButton || migrationComplete) {
      return;
    }
    migrateButton.disabled = true;
    setMigrateStatus("Migrating to NoSQL...");
    try {
      const res = await fetch("/api/migrate-nosql", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Migration failed");
      }
      setMigrateStatus("Migration complete.");
      migrationComplete = true;
      if (migrateHint) {
        migrateHint.textContent =
          "NoSQL mode active for UC1, UC2, and analytics reports.";
      }
      state.usecase1ApiBase = "/api/usecase1";
      await actions.resetUseCase1State?.();
      actions.resetUseCase2State?.();
      await actions.loadUseCaseCustomers?.();
    } catch (err) {
      setMigrateStatus("Migration failed.", true);
    } finally {
      if (!migrationComplete && migrateButton) {
        migrateButton.disabled = false;
      }
    }
  }

  if (migrateButton) {
    migrateButton.addEventListener("click", migrateNoSql);
  }
}
