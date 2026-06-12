const { getCategories, getServiceClient, sendError } = require("./_supabase");

function cleanText(value, maxLength) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const supabase = getServiceClient();
      const { data, error } = await supabase
        .from("prayer_requests")
        .select("id, created_at, name, category, prayer_request, urgent")
        .eq("public_permission", true)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      res.status(200).json({ prayers: data || [] });
      return;
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const categories = getCategories();
      const prayerRequest = cleanText(body.prayerRequest, 4000);
      const category = categories.includes(body.category) ? body.category : "Other";
      const name = cleanText(body.name, 120);
      const phone = cleanText(body.phone, 40);

      if (!prayerRequest) {
        res.status(400).json({ error: "Prayer request is required." });
        return;
      }

      const supabase = getServiceClient();
      const { error } = await supabase.from("prayer_requests").insert({
        name,
        phone,
        wants_contact: Boolean(body.wantsContact && name && phone),
        category,
        public_permission: Boolean(body.publicPermission),
        prayer_request: prayerRequest,
        urgent: Boolean(body.urgent),
        status: "new"
      });

      if (error) throw error;
      res.status(201).json({ ok: true });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    sendError(res, error);
  }
};
