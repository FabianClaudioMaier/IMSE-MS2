const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { pool } = require("./db");

const seedPath = path.join(__dirname, "..", "..", "seed", "generate_data.sql");

async function hasSeedData() {
  const [rows] = await pool.query("SELECT COUNT(*) AS count FROM Person");
  return rows[0].count > 0;
}

const router = express.Router();

router.get("/seed-status", async (req, res) => {
  try {
    const seeded = await hasSeedData();
    res.json({ seeded });
  } catch (err) {
    res.status(500).json({ error: "Failed to check seed status" });
  }
});

router.post("/generate", async (req, res) => {
  try {
    const seeded = await hasSeedData();
    if (seeded) {
      res.status(409).json({ error: "Data already generated" });
      return;
    }

    const seedSql = await fs.readFile(seedPath, "utf8");
    await pool.query(seedSql);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate data" });
  }
});

module.exports = { router };
