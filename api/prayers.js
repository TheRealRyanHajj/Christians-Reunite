const { getCategories, getServiceClient, sendError } = require("./_supabase");

function cleanText(value, maxLength) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const {
        q = "",
        category = "all",
        priority = "all",
        sort = "newest",
        page = "1",
        pageSize = "30"
      } = req.query || {};
      const currentPage = Math.max(Number.parseInt(page, 10) || 1, 1);
      const limit = Math.min(Math.max(Number.parseInt(pageSize, 10) || 30, 10), 60);
      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;
      const search = String(q).trim();
      const supabase = getServiceClient();

      let query = supabase
        .from("prayer_requests")
        .select("id, created_at, name, category, prayer_request, urgent, prayed_count", { count: "exact" })
        .eq("public_permission", true)
        .neq("status", "archived");

      if (category !== "all") query = query.eq("category", String(category));
      if (priority === "urgent") query = query.eq("urgent", true);
      if (priority === "not-prayed") query = query.or("prayed_count.is.null,prayed_count.eq.0");

      if (search) {
        const safeSearch = search.replace(/[%(),]/g, " ");
        query = query.or(`name.ilike.%${safeSearch}%,category.ilike.%${safeSearch}%,prayer_request.ilike.%${safeSearch}%`);
      }

      if (sort === "oldest") {
        query = query.order("created_at", { ascending: true });
      } else if (sort === "not-prayed") {
        query = query.order("prayed_count", { ascending: true, nullsFirst: true }).order("created_at", { ascending: false });
      } else if (sort === "most-prayed") {
        query = query.order("prayed_count", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;
      res.status(200).json({
        prayers: data || [],
        page: currentPage,
        pageSize: limit,
        total: count || 0,
        totalPages: Math.max(Math.ceil((count || 0) / limit), 1)
      });
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
        prayed_count: 0,
        status: "new"
      });

      if (error) throw error;
      res.status(201).json({ ok: true });
      return;
    }

    if (req.method === "PATCH") {
      const { id, action } = req.body || {};
      if (!id || action !== "prayed") {
        res.status(400).json({ error: "Invalid request." });
        return;
      }

      const supabase = getServiceClient();
      const { data, error: readError } = await supabase
        .from("prayer_requests")
        .select("prayed_count")
        .eq("id", id)
        .eq("public_permission", true)
        .neq("status", "archived")
        .single();

      if (readError) throw readError;

      const nextCount = Number(data?.prayed_count || 0) + 1;
      const { error } = await supabase
        .from("prayer_requests")
        .update({ prayed_count: nextCount })
        .eq("id", id)
        .eq("public_permission", true);

      if (error) throw error;
      res.status(200).json({ prayedCount: nextCount });
      return;
    }

    res.setHeader("Allow", "GET, POST, PATCH");
    res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    sendError(res, error);
  }
};
