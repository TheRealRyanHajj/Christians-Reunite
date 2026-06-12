const { getEnv, sendError } = require("./_supabase");

module.exports = function handler(req, res) {
  try {
    res.status(200).json({
      supabaseUrl: getEnv("SUPABASE_URL"),
      supabaseAnonKey: getEnv("SUPABASE_ANON_KEY"),
      googleClientId: getEnv("GOOGLE_CLIENT_ID")
    });
  } catch (error) {
    sendError(res, error);
  }
};
