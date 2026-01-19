const express = require("express");
const path = require("path");

const {
  waitForDatabase,
  waitForSchema,
  ensureBookingTotalCostsColumn,
} = require("./server/system/db");
const { router: seedRouter } = require("./server/system/seed");
const { router: migrateRouter } = require("./server/system/migrate");
const { router: tablesRouter } = require("./server/system/tables");
const { router: usecase1Router } = require("./server/usecase1/routes");
const { router: usecase2Router } = require("./server/usecase2/routes");

const port = process.env.PORT || 3000;
const webport = process.env.WEB_PORT || 8080;
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api", tablesRouter);
app.use("/api", seedRouter);
app.use("/api", migrateRouter);
app.use("/api", usecase1Router);
app.use("/api", usecase2Router);

async function start() {
  try {
    await waitForDatabase();
    await waitForSchema();
    await ensureBookingTotalCostsColumn();
    app.listen(port, () => {
      console.log(`UI running on http://localhost:${webport}`);
    });
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
}

start();
