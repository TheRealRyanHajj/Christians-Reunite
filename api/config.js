const { getEnv, sendError } = require("./_supabase");

function getAuthRedirectUrl() {
  if (process.env.GOOGLE_AUTH_REDIRECT_URL) {
    return process.env.GOOGLE_AUTH_REDIRECT_URL;
  }

  const siteUrl = process.env.PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return siteUrl ? `${siteUrl.replace(/\/$/, "")}/admin.html` : "";
}

module.exports = function handler(req, res) {
  try {
    res.status(200).json({
      supabaseUrl: getEnv("SUPABASE_URL"),
      supabaseAnonKey: getEnv("SUPABASE_ANON_KEY"),
      authRedirectUrl: getAuthRedirectUrl()
    });
  } catch (error) {
    sendError(res, error);
  }
};
