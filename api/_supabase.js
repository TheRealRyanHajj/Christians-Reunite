const { createClient } = require("@supabase/supabase-js");
const { OAuth2Client } = require("google-auth-library");

const DEFAULT_CATEGORIES = [
  "Addiction",
  "Family",
  "Finances",
  "Health",
  "Marriage",
  "Grief",
  "Guidance",
  "Salvation",
  "Community",
  "Other"
];

function getEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getServiceClient() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  });
}

function getCategories() {
  return (process.env.PRAYER_CATEGORIES || DEFAULT_CATEGORIES.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

async function requireAdmin(req) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error("Not signed in.");
    error.status = 401;
    throw error;
  }

  const supabase = getServiceClient();
  const googleClient = new OAuth2Client(getEnv("GOOGLE_CLIENT_ID"));
  const ticket = await googleClient.verifyIdToken({
    idToken: token,
    audience: getEnv("GOOGLE_CLIENT_ID")
  });
  const payload = ticket.getPayload();

  if (!payload?.email || !payload.email_verified) {
    const authError = new Error("Invalid sign-in session.");
    authError.status = 401;
    throw authError;
  }

  const email = payload.email.toLowerCase();
  if (!getAdminEmails().includes(email)) {
    const forbidden = new Error("This account is not allowed to access admin.");
    forbidden.status = 403;
    throw forbidden;
  }

  return { supabase, user: { email } };
}

function sendError(res, error) {
  res.status(error.status || 500).json({ error: error.message || "Server error." });
}

module.exports = {
  getCategories,
  getEnv,
  getServiceClient,
  requireAdmin,
  sendError
};
