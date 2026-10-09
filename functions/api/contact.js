
const MAX_BYTES = 12000;

const ALLOWED_HOSTNAMES = [
  "ssunlimitedllc.com",
  "www.ssunlimitedllc.com",
  "ssunlimitedllc-site.pages.dev"
];

const INQUIRY_LABELS = {
  review: "Infrastructure Review",
  commercial: "Commercial Project",
  government: "Government / Prime Teaming",
  general: "General Inquiry"
};

const errorResponse = (message, status) =>
  Response.json({ success: false, message }, { status });

export async function onRequestPost({ request, env }) {
  try {
    // Validate request format and size.
    const contentType = request.headers.get("content-type") || "";
    if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
      return errorResponse("Unsupported request format.", 415);
    }

    const lengthHeader = request.headers.get("content-length");
    const declaredLength = lengthHeader === null ? 0 : Number(lengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
      return errorResponse("Your inquiry is too large.", 413);
    }

    const reader = request.body?.getReader();
    if (!reader) return errorResponse("Request body is required.", 400);

    const chunks = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_BYTES) {
        await reader.cancel();
        return errorResponse("Your inquiry is too large.", 413);
      }
      chunks.push(value);
    }

    const body = new Uint8Array(totalBytes);
    let offset = 0;

    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    // Parse and validate JSON.
    let data;
    try {
      data = JSON.parse(new TextDecoder().decode(body));
    } catch {
      return errorResponse("Invalid request data.", 400);
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return errorResponse("Invalid request data.", 400);
    }

    // Honeypot spam protection.
    if (data.websiteUrl) {
      return errorResponse("Unable to process your inquiry.", 400);
    }

    // Verify Cloudflare Turnstile.
    const token = data.turnstileToken;
    if (typeof token !== "string" || !token.trim()) {
      return errorResponse("Security verification is required.", 400);
    }

    if (!env.TURNSTILE_SECRET_KEY) {
      console.error("Missing TURNSTILE_SECRET_KEY");
      return errorResponse("Contact form is temporarily unavailable.", 503);
    }

    const turnstileResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token
        })
      }
    );

    if (!turnstileResponse.ok) {
      throw new Error("Turnstile verification service unavailable.");
    }

    const verification = await turnstileResponse.json();

    if (!verification.success) {
      return errorResponse("Security verification failed. Please try again.", 403);
    }

    if (!ALLOWED_HOSTNAMES.includes(verification.hostname)) {
      return errorResponse("Security verification failed.", 403);
    }

    // Validate inquiry fields.
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const email = typeof data.email === "string" ? data.email.trim() : "";
    const company = typeof data.company === "string" ? data.company.trim() : "";
    const message = typeof data.message === "string" ? data.message.trim() : "";
    const inquiryType = data.inquiryType;

    const validInquiry = (
      typeof inquiryType === "string" &&
      Object.prototype.hasOwnProperty.call(INQUIRY_LABELS, inquiryType)
    );

    if (
      !validInquiry ||
      name.length < 2 || name.length > 120 ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      company.length > 150 ||
      message.length < 10 || message.length > 5000
    ) {
      return errorResponse("Please check your inquiry details.", 400);
    }

    // Build the email.
    const label = INQUIRY_LABELS[inquiryType];
    const subject = `SS Unlimited Inquiry: ${label}`;
    const emailBody = [
      `Inquiry Type: ${label}`,
      `Name: ${name}`,
      `Email: ${email}`,
      `Company: ${company || "Not provided"}`,
      "",
      "Project Details:",
      message
    ].join("\n");

    if (!env.RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY");
      return errorResponse("Email delivery is temporarily unavailable.", 503);
    }

    // Send inquiry using Resend.
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "SS Unlimited Website <inquiries@send.ssunlimitedllc.com>",
        to: ["info@ssunlimitedllc.com"],
        reply_to: email,
        subject,
        text: emailBody
      })
    });

    if (!resendResponse.ok) {
      console.error("Resend rejected inquiry:", resendResponse.status);
      return errorResponse(
        "We couldn't submit your inquiry. Please email us directly.",
        502
      );
    }

    return Response.json({
      success: true,
      message: "Your inquiry was accepted for delivery."
    });
  } catch (error) {
    console.error("Contact form error:", error);
    return errorResponse("Unable to process your inquiry.", 500);
  }
}
