const { getCategories } = require("./_supabase");

module.exports = function handler(req, res) {
  res.status(200).json({ categories: getCategories() });
};
