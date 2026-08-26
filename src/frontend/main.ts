// src/frontend/main.ts
import { HttpClient } from "../http/HttpClient";
import { MemoryCacheStore } from "../cache/MemoryCacheStore";
import { CacheLogger } from "../logger/CacheLogger";
import { CachedApiClient } from "../http/CachedApiClient";
import { ItemsService } from "../services/ItemsService";

const http = new HttpClient(); // real browser fetch → Express backend
const cache = new MemoryCacheStore();
const logger = new CacheLogger();
const api = new CachedApiClient(http, cache, logger);
const items = new ItemsService(api);

const listEl = document.getElementById("list")!;
const logEl = document.getElementById("log")!;
const userSelect = document.getElementById("userSelect") as HTMLSelectElement;

logger.onLog((entry) => {
  const line = document.createElement("div");
  line.textContent = `[${entry.level.toUpperCase()}] ${entry.message}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
});

async function renderList(): Promise<void> {
  const list = await items.getList(userSelect.value);
  listEl.innerHTML = list
    .map((i) => `<div class="item"><span>${i.name} (#${i.id})</span><strong>${i.value}</strong></div>`)
    .join("");
}

document.getElementById("refreshBtn")!.addEventListener("click", renderList);
userSelect.addEventListener("change", renderList);

document.getElementById("updateBtn")!.addEventListener("click", async () => {
  const itemId = (document.getElementById("itemId") as HTMLInputElement).value.trim();
  const value = Number((document.getElementById("itemValue") as HTMLInputElement).value);
  if (!itemId || Number.isNaN(value)) return;

  await items.updateItem(userSelect.value, itemId, { value });
  await renderList(); // must show the fresh value immediately, not stale
});

renderList();
