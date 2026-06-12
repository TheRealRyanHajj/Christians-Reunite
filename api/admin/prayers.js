const { requireAdmin, sendError } = require("../_supabase");

module.exports = async function handler(req, res) {
  try {
    const { supabase } = await requireAdmin(req);

    if (req.method === "GET") {
      const {
        q = "",
        status = "active",
        priority = "all",
        sort = "newest",
        page = "1",
        pageSize = "50"
      } = req.query || {};
      const currentPage = Math.max(Number.parseInt(page, 10) || 1, 1);
      const limit = Math.min(Math.max(Number.parseInt(pageSize, 10) || 50, 10), 100);
      const from = (currentPage - 1) * limit;
      const to = from + limit - 1;
      const search = String(q).trim();

      let query = supabase
        .from("prayer_requests")
        .select("*", { count: "exact" });

      if (status === "active") {
        query = query.neq("status", "archived");
      } else if (["new", "prayed", "archived"].includes(status)) {
        query = query.eq("status", status);
      }

      if (priority === "urgent") query = query.eq("urgent", true);
      if (priority === "contact") query = query.eq("wants_contact", true);
      if (priority === "wall") query = query.eq("public_permission", true);
      if (priority === "private") query = query.eq("public_permission", false);

      if (search) {
        const safeSearch = search.replace(/[%(),]/g, " ");
        query = query.or(
          `name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%,category.ilike.%${safeSearch}%,prayer_request.ilike.%${safeSearch}%`
        );
      }

      if (sort === "oldest") {
        query = query.order("created_at", { ascending: true });
      } else if (sort === "urgent") {
        query = query.order("urgent", { ascending: false }).order("created_at", { ascending: false });
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

    if (req.method === "PATCH") {
      const { id, status } = req.body || {};
      if (!id || !["new", "prayed", "archived"].includes(status)) {
        res.status(400).json({ error: "Invalid request." });
        return;
      }

      const { error } = await supabase
        .from("prayer_requests")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader("Allow", "GET, PATCH");
    res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    sendError(res, error);
  }
};
