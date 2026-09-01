const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

async function ensureSchema(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS inv_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      row_key TEXT NOT NULL UNIQUE,
      carton TEXT,
      sku TEXT NOT NULL,
      opening_qty INTEGER NOT NULL DEFAULT 0,
      outbound_qty INTEGER NOT NULL DEFAULT 0,
      remaining_qty INTEGER NOT NULL DEFAULT 0,
      source_row INTEGER,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS inv_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_type TEXT NOT NULL,
      row_key TEXT,
      carton TEXT,
      sku TEXT NOT NULL,
      qty INTEGER NOT NULL,
      order_no TEXT,
      tracking_no TEXT,
      carrier TEXT,
      shipment_no TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS inv_shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_no TEXT NOT NULL UNIQUE,
      order_no TEXT,
      tracking_no TEXT,
      carrier TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS inv_shipment_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_no TEXT NOT NULL,
      row_key TEXT NOT NULL,
      carton TEXT,
      sku TEXT NOT NULL,
      qty INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_inv_tx_created ON inv_transactions(created_at DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_inv_ship_created ON inv_shipments(created_at DESC)`)
  ]);
  // Safe migration when this app reuses an existing D1 database.
  try { await db.prepare(`ALTER TABLE inv_transactions ADD COLUMN shipment_no TEXT`).run(); } catch {}
  try { await db.prepare(`CREATE INDEX IF NOT EXISTS idx_inv_tx_shipment ON inv_transactions(shipment_no)`).run(); } catch {}
}

function now() { return new Date().toISOString(); }
function clean(v) { return v == null ? "" : String(v).trim(); }
function n(v) { const x = Number(v); return Number.isFinite(x) ? Math.trunc(x) : 0; }

export async function onRequestGet(context) {
  const db = context.env.INVENTORY_DB;
  if (!db) return json({ ok:false, error:"INVENTORY_DB binding missing" }, 500);
  await ensureSchema(db);
  const [items, tx, shipments, lines] = await Promise.all([
    db.prepare(`SELECT * FROM inv_items ORDER BY COALESCE(source_row,999999), id`).all(),
    db.prepare(`SELECT * FROM inv_transactions ORDER BY id DESC LIMIT 500`).all(),
    db.prepare(`SELECT * FROM inv_shipments ORDER BY id DESC LIMIT 300`).all(),
    db.prepare(`SELECT * FROM inv_shipment_lines ORDER BY id DESC LIMIT 1500`).all()
  ]);
  return json({ ok:true, items:items.results||[], transactions:tx.results||[], shipments:shipments.results||[], shipmentLines:lines.results||[] });
}

export async function onRequestPost(context) {
  const db = context.env.INVENTORY_DB;
  if (!db) return json({ ok:false, error:"INVENTORY_DB binding missing" }, 500);
  await ensureSchema(db);
  let body;
  try { body = await context.request.json(); } catch { return json({ok:false,error:"Invalid JSON"},400); }
  const action = clean(body.action);
  const ts = now();

  if (action === "replace_inventory") {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const stmts = [db.prepare(`DELETE FROM inv_items`)];
    for (const r of rows) {
      const sku = clean(r.sku); if (!sku) continue;
      const opening = n(r.openingQty), outbound = n(r.outboundQty), remaining = n(r.remainingQty ?? (opening-outbound));
      const rowKey = clean(r.rowKey) || `row:${n(r.sourceRow)}:${sku}`;
      stmts.push(db.prepare(`INSERT INTO inv_items(row_key,carton,sku,opening_qty,outbound_qty,remaining_qty,source_row,updated_at) VALUES(?,?,?,?,?,?,?,?)`)
        .bind(rowKey, clean(r.carton), sku, opening, outbound, remaining, n(r.sourceRow)||null, ts));
    }
    if (stmts.length > 1) await db.batch(stmts); else await stmts[0].run();
    return json({ok:true, count: Math.max(0, stmts.length-1)});
  }

  if (action === "stock_in") {
    const rowKey = clean(body.rowKey), sku = clean(body.sku), carton = clean(body.carton), qty = n(body.qty);
    if (!sku || qty <= 0) return json({ok:false,error:"SKU and positive qty required"},400);
    let key = rowKey;
    if (!key) {
      key = `manual:${crypto.randomUUID()}`;
      await db.prepare(`INSERT INTO inv_items(row_key,carton,sku,opening_qty,outbound_qty,remaining_qty,source_row,updated_at) VALUES(?,?,?,?,?,?,NULL,?)`)
        .bind(key, carton, sku, qty, 0, qty, ts).run();
    } else {
      const cur = await db.prepare(`SELECT * FROM inv_items WHERE row_key=?`).bind(key).first();
      if (!cur) return json({ok:false,error:"Inventory row not found"},404);
      await db.prepare(`UPDATE inv_items SET opening_qty=opening_qty+?, remaining_qty=remaining_qty+?, updated_at=? WHERE row_key=?`)
        .bind(qty, qty, ts, key).run();
    }
    await db.prepare(`INSERT INTO inv_transactions(tx_type,row_key,carton,sku,qty,note,created_at) VALUES('IN',?,?,?,?,?,?)`)
      .bind(key, carton, sku, qty, clean(body.note), ts).run();
    return json({ok:true,rowKey:key});
  }

  if (action === "ship") {
    const lines = Array.isArray(body.lines) ? body.lines.filter(x=>n(x.qty)>0) : [];
    if (!lines.length) return json({ok:false,error:"Shipment lines required"},400);
    const shipmentNo = clean(body.shipmentNo) || `SHP-${Date.now()}`;
    const orderNo = clean(body.orderNo), tracking = clean(body.trackingNo), carrier = clean(body.carrier), note = clean(body.note);
    const checks = [];
    for (const l of lines) {
      const cur = await db.prepare(`SELECT * FROM inv_items WHERE row_key=?`).bind(clean(l.rowKey)).first();
      if (!cur) return json({ok:false,error:`Inventory row missing: ${clean(l.rowKey)}`},404);
      if (n(l.qty) > n(cur.remaining_qty)) return json({ok:false,error:`${cur.sku} stock insufficient`},409);
      checks.push({cur, qty:n(l.qty)});
    }
    const stmts = [
      db.prepare(`INSERT INTO inv_shipments(shipment_no,order_no,tracking_no,carrier,status,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`)
        .bind(shipmentNo, orderNo, tracking, carrier, tracking?"shipped":"pending", note, ts, ts)
    ];
    for (const {cur,qty} of checks) {
      stmts.push(db.prepare(`UPDATE inv_items SET outbound_qty=outbound_qty+?, remaining_qty=remaining_qty-?, updated_at=? WHERE row_key=?`).bind(qty,qty,ts,cur.row_key));
      stmts.push(db.prepare(`INSERT INTO inv_shipment_lines(shipment_no,row_key,carton,sku,qty) VALUES(?,?,?,?,?)`).bind(shipmentNo,cur.row_key,cur.carton||"",cur.sku,qty));
      stmts.push(db.prepare(`INSERT INTO inv_transactions(tx_type,row_key,carton,sku,qty,order_no,tracking_no,carrier,shipment_no,note,created_at) VALUES('OUT',?,?,?,?,?,?,?,?,?,?)`)
        .bind(cur.row_key,cur.carton||"",cur.sku,qty,orderNo,tracking,carrier,shipmentNo,note,ts));
    }
    await db.batch(stmts);
    return json({ok:true,shipmentNo});
  }

  if (action === "update_tracking") {
    const shipmentNo = clean(body.shipmentNo), tracking = clean(body.trackingNo), carrier = clean(body.carrier);
    if (!shipmentNo) return json({ok:false,error:"shipmentNo required"},400);
    const r = await db.prepare(`UPDATE inv_shipments SET tracking_no=?, carrier=?, status=?, updated_at=? WHERE shipment_no=?`)
      .bind(tracking,carrier,tracking?"shipped":"pending",ts,shipmentNo).run();
    await db.prepare(`UPDATE inv_transactions SET tracking_no=?, carrier=? WHERE tx_type='OUT' AND shipment_no=?`)
      .bind(tracking,carrier,shipmentNo).run().catch(()=>{});
    return json({ok:true,changed:r.meta?.changes||0});
  }

  if (action === "delete_shipment") {
    const shipmentNo = clean(body.shipmentNo); if (!shipmentNo) return json({ok:false,error:"shipmentNo required"},400);
    const lines = await db.prepare(`SELECT * FROM inv_shipment_lines WHERE shipment_no=?`).bind(shipmentNo).all();
    const stmts=[];
    for (const l of (lines.results||[])) {
      stmts.push(db.prepare(`UPDATE inv_items SET outbound_qty=MAX(0,outbound_qty-?), remaining_qty=remaining_qty+?, updated_at=? WHERE row_key=?`).bind(n(l.qty),n(l.qty),ts,l.row_key));
    }
    stmts.push(db.prepare(`DELETE FROM inv_transactions WHERE tx_type='OUT' AND shipment_no=?`).bind(shipmentNo));
    stmts.push(db.prepare(`DELETE FROM inv_shipment_lines WHERE shipment_no=?`).bind(shipmentNo));
    stmts.push(db.prepare(`DELETE FROM inv_shipments WHERE shipment_no=?`).bind(shipmentNo));
    await db.batch(stmts);
    return json({ok:true});
  }

  return json({ok:false,error:`Unknown action: ${action}`},400);
}
