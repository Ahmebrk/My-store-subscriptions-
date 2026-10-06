
import { getStore } from "@netlify/blobs";
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const cl = (v, n) => String(v ?? "").slice(0, n);
const all = (s, p) => s.list({ prefix: p }).then(l => Promise.all(l.blobs.map(x => s.get(x.key, { type: "json" })))).then(a => a.filter(Boolean));

export default async (req) => {
  const s = getStore("mystore");
  const r = new URL(req.url).pathname.replace(/^\/api\//, "").replace(/\/$/, "");
  const pw = process.env.ADMIN_PASSWORD;
  const admin = !!pw && decodeURIComponent(req.headers.get("x-admin") || "") === pw;
  const b = req.method === "GET" ? {} : await req.json().catch(() => ({}));

  if (r === "config" && req.method === "GET") return J(await s.get("config", { type: "json" }));
  if (r === "order" && req.method === "POST" && !admin) {
    if (!cl(b.name, 60) || !cl(b.phone, 25) || !cl(b.item, 120)) return J({ error: 1 }, 400);
  }
  if (r === "order" && req.method === "POST") {
    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    await s.setJSON("orders/" + id, { id, name: cl(b.name, 60), phone: cl(b.phone, 25), item: cl(b.item, 120), price: Number(b.price) || 0, status: "new", t: Date.now() });
    return J({ ok: 1 });
  }
  if (r === "visit" && req.method === "POST") {
    const day = new Date().toISOString().slice(0, 10), k = "stats/" + day;
    const d = (await s.get(k, { type: "json" })) || { d: day, v: 0, u: 0 };
    d.v++; if (b.u) d.u++;
    await s.setJSON(k, d);
    return J({ ok: 1 });
  }
  if (!admin) return J({ error: "unauthorized" }, 401);
  if (r === "login") return J({ ok: 1 });
  if (r === "config" && req.method === "PUT") {
    await s.setJSON("config", { wa: cl(b.wa, 25), ig: cl(b.ig, 40), products: Array.isArray(b.products) ? b.products : [] });
    return J({ ok: 1 });
  }
  if (r === "orders") return J((await all(s, "orders/")).sort((a, c) => c.t - a.t));
  if (r === "stats") return J(await all(s, "stats/"));
  if (r === "order-update") {
    const k = "orders/" + cl(b.id, 40);
    if (b.del) await s.delete(k);
    else {
      const o = await s.get(k, { type: "json" });
      if (o && ["new", "ok", "no", "done"].includes(b.status)) { o.status = b.status; await s.setJSON(k, o); }
    }
    return J({ ok: 1 });
  }
  return J({ error: "not found" }, 404);
};

export const config = { path: "/api/*" };
