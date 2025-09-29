// netlify/functions/create-order.js

// Hjälpare för Supabase REST
async function supabase(reqPath, method, body) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("Saknar SUPABASE_URL eller SUPABASE_SERVICE_ROLE");
  }
  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_SERVICE_ROLE,
    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE}`,
    "Prefer": "return=representation"
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${reqPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase ${reqPath} ${res.status}: ${txt}`);
  }
  return res.json();
}

// Hämta eller skapa kund
async function upsertCustomer(email, name, phone) {
  // Finns kund?
  const q = await supabase(`customers?email=eq.${encodeURIComponent(email)}&select=*`, "GET");
  if (Array.isArray(q) && q.length) return q[0];

  // Skapa ny
  const ins = await supabase("customers", "POST", [{ email, name, phone }]);
  return ins[0];
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { cart, customer, shipping } = JSON.parse(event.body || "{}");
    // cart: [{ sku, name, price (öre), qty }]
    if (!Array.isArray(cart) || cart.length === 0) {
      return { statusCode: 400, body: "Cart is empty" };
    }
    if (!customer?.email) {
      return { statusCode: 400, body: "Missing customer email" };
    }

    // 1) summera order
    let total = 0;
    cart.forEach(i => { total += (parseInt(i.price,10)||0) * (parseInt(i.qty,10)||1); });

    // 2) kund
    const cust = await upsertCustomer(String(customer.email).trim(), customer.name || "", customer.phone || "");

    // 3) order
    const orderRows = await supabase("orders", "POST", [{
      customer_id: cust.id,
      total_ore: total,
      currency: "SEK",
      lead_days: shipping?.lead_days || 5,
      status: "pending", // tills betalning kopplas på
      shipping_name: shipping?.name || "",
      shipping_address: shipping?.address || null
    }]);
    const order = orderRows[0];

    // 4) orderrader
    const items = cart.map(i => ({
      order_id: order.id,
      sku: i.sku || null,
      name: i.name,
      qty: i.qty || 1,
      price_ore: i.price
    }));
    await supabase("order_items", "POST", items);

    // 5) svar – redirect till tack-sida
    const base = process.env.URL || "";
    const thankUrl = `${base}/thank-you.html?order_id=${order.id}`;
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, order_id: order.id, url: thankUrl })
    };

  } catch (e) {
    return { statusCode: 500, body: "Create-order error: " + e.message };
  }
}
