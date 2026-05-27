export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!apiKey) {
    return res.status(500).json({
      error: "API key not configured. Add ANTHROPIC_API_KEY in Vercel Project Settings, then redeploy."
    });
  }

  try {
    const requestBody = {
      ...req.body,
      model: req.body?.model || "claude-sonnet-4-6"
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

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.message ||
        `Anthropic API failed with status ${response.status}`;

      console.error("Anthropic API error:", {
        status: response.status,
        type: data?.error?.type,
        message,
        requestId: data?.request_id
      });

      return res.status(response.status).json({
        error: message,
        type: data?.error?.type || "anthropic_error",
        status: response.status
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("API route error:", error);

    return res.status(500).json({
      error: "Server failed while contacting Anthropic."
    });
  }
}export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!apiKey) {
    return res.status(500).json({
      error: "API key not configured. Add ANTHROPIC_API_KEY in Vercel Project Settings, then redeploy."
    });
  }

  try {
    const requestBody = {
      ...req.body,
      model: req.body?.model || "claude-sonnet-4-6"
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

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.message ||
        `Anthropic API failed with status ${response.status}`;

      console.error("Anthropic API error:", {
        status: response.status,
        type: data?.error?.type,
        message,
        requestId: data?.request_id
      });

      return res.status(response.status).json({
        error: message,
        type: data?.error?.type || "anthropic_error",
        status: response.status
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("API route error:", error);

    return res.status(500).json({
      error: "Server failed while contacting Anthropic."
    });
  }
}
