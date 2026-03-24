const { getDB } = require('../db/database');

function buildGraph(limit = 150) {
  const db = getDB();
  const nodes = [];
  const edges = [];
  const nodeSet = new Set();

  function addNode(id, label, type, props = {}) {
    if (!nodeSet.has(id)) {
      nodeSet.add(id);
      nodes.push({ id, label, type, props });
    }
  }
  function addEdge(from, to, label) {
    if (nodeSet.has(from) || nodeSet.has(to)) {
      edges.push({ id: `${from}__${to}__${label}`, source: from, target: to, label });
    }
  }

  const partners = db.prepare(`SELECT * FROM business_partners`).all();
  for (const r of partners) {
    addNode(`bp_${r.businessPartner}`, r.businessPartnerFullName || r.businessPartner, 'Customer', r);
  }

  const soHeaders = db.prepare(`SELECT * FROM sales_order_headers LIMIT ?`).all(limit);
  for (const r of soHeaders) {
    addNode(`so_${r.salesOrder}`, `SO ${r.salesOrder}`, 'SalesOrder', r);
    if (r.soldToParty) addEdge(`bp_${r.soldToParty}`, `so_${r.salesOrder}`, 'placed');
  }

  const soItems = db.prepare(`SELECT * FROM sales_order_items LIMIT 120`).all();
  for (const r of soItems) {
    const itemId = `soi_${r.salesOrder}_${r.salesOrderItem}`;
    addNode(itemId, `Item ${r.salesOrderItem}`, 'SOItem', r);
    addEdge(`so_${r.salesOrder}`, itemId, 'contains');
    if (r.material) {
      addNode(`mat_${r.material}`, r.material.substring(0, 15), 'Material', { material: r.material });
      addEdge(itemId, `mat_${r.material}`, 'is');
    }
  }

  const plants = db.prepare(`SELECT * FROM plants`).all();
  for (const r of plants) {
    addNode(`plant_${r.plant}`, r.plantName || r.plant, 'Plant', r);
  }

  const deliveries = db.prepare(`SELECT * FROM outbound_delivery_headers LIMIT ?`).all(limit);
  for (const r of deliveries) {
    addNode(`del_${r.deliveryDocument}`, `Del ${r.deliveryDocument}`, 'Delivery', r);
    if (r.shippingPoint) addEdge(`del_${r.deliveryDocument}`, `plant_${r.shippingPoint}`, 'ships from');
  }

  const bills = db.prepare(`SELECT * FROM billing_document_cancellations`).all();
  for (const r of bills) {
    addNode(`bill_${r.billingDocument}`, `Bill ${r.billingDocument}`, 'BillingDoc', r);
    if (r.soldToParty) addEdge(`bp_${r.soldToParty}`, `bill_${r.billingDocument}`, 'billed to');
    const so = db.prepare(`SELECT salesOrder FROM sales_order_headers WHERE soldToParty=? LIMIT 1`).get(r.soldToParty);
    if (so) addEdge(`so_${so.salesOrder}`, `bill_${r.billingDocument}`, 'billed as');
  }

  const payments = db.prepare(`SELECT * FROM payments_accounts_receivable LIMIT 80`).all();
  for (const r of payments) {
    addNode(`pay_${r.accountingDocument}`, `Pay ${r.accountingDocument}`, 'Payment', r);
    addEdge(`bill_${r.accountingDocument}`, `pay_${r.accountingDocument}`, 'paid via');
    if (r.customer) addEdge(`bp_${r.customer}`, `pay_${r.accountingDocument}`, 'paid by');
  }

  const journals = db.prepare(`SELECT * FROM journal_entry_items_accounts_receivable LIMIT 80`).all();
  for (const r of journals) {
    addNode(`je_${r.accountingDocument}`, `JE ${r.accountingDocument}`, 'JournalEntry', r);
    if (r.clearingAccountingDocument) {
      addEdge(`pay_${r.clearingAccountingDocument}`, `je_${r.accountingDocument}`, 'cleared by');
    }
  }

  const edgeMap = new Map();
  for (const e of edges) {
    if (nodeSet.has(e.source) && nodeSet.has(e.target)) {
      edgeMap.set(e.id, e);
    }
  }

  return { nodes, edges: Array.from(edgeMap.values()) };
}

function expandNode(nodeId) {
  const db = getDB();
  const nodes = [];
  const edges = [];
  const nodeSet = new Set();

  const [prefix, ...rest] = nodeId.split('_');
  const key = rest.join('_');

  function addNode(id, label, type, props = {}) {
    if (!nodeSet.has(id)) { nodeSet.add(id); nodes.push({ id, label, type, props }); }
  }
  function addEdge(from, to, label) {
    edges.push({ id: `${from}__${to}__${label}`, source: from, target: to, label });
  }

  if (prefix === 'bp') {
    const orders = db.prepare(`SELECT * FROM sales_order_headers WHERE soldToParty=? LIMIT 10`).all(key);
    for (const r of orders) {
      addNode(`so_${r.salesOrder}`, `SO ${r.salesOrder}`, 'SalesOrder', r);
      addEdge(nodeId, `so_${r.salesOrder}`, 'placed');
    }
    const bills = db.prepare(`SELECT * FROM billing_document_cancellations WHERE soldToParty=? LIMIT 10`).all(key);
    for (const r of bills) {
      addNode(`bill_${r.billingDocument}`, `Bill ${r.billingDocument}`, 'BillingDoc', r);
      addEdge(nodeId, `bill_${r.billingDocument}`, 'billed to');
    }
  }

  if (prefix === 'so') {
    const items = db.prepare(`SELECT * FROM sales_order_items WHERE salesOrder=?`).all(key);
    for (const r of items) {
      const iid = `soi_${r.salesOrder}_${r.salesOrderItem}`;
      addNode(iid, `Item ${r.salesOrderItem}`, 'SOItem', r);
      addEdge(nodeId, iid, 'contains');
      if (r.material) {
        addNode(`mat_${r.material}`, r.material, 'Material', { material: r.material });
        addEdge(iid, `mat_${r.material}`, 'is');
      }
    }
  }

  if (prefix === 'bill') {
    const pay = db.prepare(`SELECT * FROM payments_accounts_receivable WHERE accountingDocument=?`).get(key);
    if (pay) {
      addNode(`pay_${pay.accountingDocument}`, `Pay ${pay.accountingDocument}`, 'Payment', pay);
      addEdge(nodeId, `pay_${pay.accountingDocument}`, 'paid via');
    }
  }

  return { nodes, edges };
}

module.exports = { buildGraph, expandNode };
