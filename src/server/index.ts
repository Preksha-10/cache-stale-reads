// src/server/index.ts
import express from "express";
import cors from "cors";
import { InMemoryDb } from "./InMemoryDb";

const db = new InMemoryDb();
const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/items", (req, res) => {
  const userId = String(req.query.userId ?? "user-1");
  const items = db.list(userId);
  const etag = `"${items.length}-${Math.max(0, ...items.map((i) => i.updatedAt))}"`;

  if (req.headers["if-none-match"] === etag) return res.status(304).end();

  res.setHeader("ETag", etag);
  res.json(items);
});

app.patch("/api/items/:id", (req, res) => {
  const userId = String(req.body.userId ?? "user-1");
  const updated = db.update(userId, req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Item not found" });
  res.json(updated);
});

app.listen(3001, () => console.log("API listening on [localhost](http://localhost:3001)"));
