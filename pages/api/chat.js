const DEFAULT_MODEL = "claude-sonnet-4-6";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY is missing. Add it in Vercel Environment Variables, then redeploy."
    });
  }

  if (!apiKey.startsWith("sk-ant-")) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY does not look like a valid Anthropic key. It should start with sk-ant-."
    });
  }

  try {
    const incomingMessages = Array.isArray(req.body?.messages)
      ? req.body.messages
      : [];

    const messages = incomingMessages
      .filter((message) => message && (message.role === "user" || message.role === "assistant"))
      .map((message) => ({
        role: message.role,
        content:
          typeof message.content === "string"
            ? message.content
            : String(message.content ?? "")
      }))
      .filter((message) => message.content.trim().length > 0)
      .slice(-12);

    const system =
      typeof req.body?.system === "string"
        ? req.body.system
        : "You are Nubi, the Rare Apepes AI companion.";

    if (messages.length === 0) {
      return res.status(400).json({
        error: "No valid messages were provided."
      });
    }

    const requestBody = {
      model: DEFAULT_MODEL,
      max_tokens: Number.isInteger(req.body?.max_tokens)
        ? Math.min(Math.max(req.body.max_tokens, 64), 2000)
        : 1000,
      system,
      messages
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(requestBody)
    });

    const raw = await response.text();

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    if (!response.ok) {
      const requestId =
        response.headers.get("request-id") ||
        response.headers.get("anthropic-request-id") ||
        null;

      const errorMessage =
        data?.error?.message ||
        data?.message ||
        `Anthropic API failed with status ${response.status}`;

      console.error("Anthropic API error", {
        status: response.status,
        type: data?.error?.type,
        message: errorMessage,
        requestId
      });

      return res.status(response.status).json({
        error: errorMessage,
        type: data?.error?.type || "anthropic_error",
        status: response.status,
        requestId
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("NUBI API route error", error);

    return res.status(500).json({
      error: "Server failed while contacting Anthropic.",
      detail: error?.message || "Unknown server error"
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb"
    }
  }
};
