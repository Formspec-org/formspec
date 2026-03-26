/** @filedesc Firebase Function — Resend newsletter subscribe endpoint. */
import { onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { Resend } from "resend";

const resendApiKey = defineString("RESEND_API_KEY");
const resendAudienceId = defineString("RESEND_AUDIENCE_ID");

const ALLOWED_ORIGINS = [
  "https://formspec.org",
  "https://www.formspec.org",
  "http://localhost:4321",   // Astro dev
  "http://localhost:5050",   // Firebase emulator
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export const subscribe = onRequest({ cors: false }, async (req, res) => {
  const origin = req.headers.origin || "";
  const headers = corsHeaders(origin);

  // Preflight
  if (req.method === "OPTIONS") {
    res.set(headers).status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.set(headers).status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email } = req.body || {};
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.set(headers).status(400).json({ error: "Valid email required" });
    return;
  }

  try {
    const resend = new Resend(resendApiKey.value());
    await resend.contacts.create({
      audienceId: resendAudienceId.value(),
      email: email.trim().toLowerCase(),
    });

    res.set(headers).status(200).json({ ok: true });
  } catch (err) {
    console.error("Resend subscribe error:", err);
    // Resend returns 409 if already subscribed — treat as success
    if (err?.statusCode === 409) {
      res.set(headers).status(200).json({ ok: true });
      return;
    }
    res.set(headers).status(500).json({ error: "Subscribe failed" });
  }
});
