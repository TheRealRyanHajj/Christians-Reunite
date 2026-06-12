const { requireAdmin, sendError } = require("../_supabase");

module.exports = async function handler(req, res) {
  try {
    const { supabase } = await requireAdmin(req);

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("prayer_requests")
        .select("*")
        .neq("status", "archived")
        .order("urgent", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      res.status(200).json({ prayers: data || [] });
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
