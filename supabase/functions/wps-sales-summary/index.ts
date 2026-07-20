const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: corsHeaders },
    );
  }

  const airscriptToken = Deno.env.get("WPS_AIRSCRIPT_TOKEN");
  const webhookUrl = Deno.env.get("WPS_AIRSCRIPT_WEBHOOK");

  if (!airscriptToken || !webhookUrl) {
    return new Response(
      JSON.stringify({ error: "WPS integration is not configured" }),
      { status: 500, headers: corsHeaders },
    );
  }

  try {
    const wpsResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "AirScript-Token": airscriptToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ Context: { argv: {} } }),
    });

    const payload = await wpsResponse.json();

    if (!wpsResponse.ok || payload.error || payload.status !== "finished") {
      return new Response(
        JSON.stringify({
          error: "WPS statistics request failed",
          details: payload.error || payload.error_details?.msg || payload.status,
        }),
        { status: 502, headers: corsHeaders },
      );
    }

    let summary = payload.data?.result;

    if (typeof summary === "string") {
      try {
        summary = JSON.parse(summary);
      } catch {
        // Keep a non-JSON script result so the caller can diagnose it safely.
      }
    }

    if (!summary || typeof summary !== "object") {
      return new Response(
        JSON.stringify({
          error: "WPS script returned no statistics",
          details: "Please make sure the last line of the AirScript is: return main()",
        }),
        { status: 502, headers: corsHeaders },
      );
    }

    return new Response(
      JSON.stringify({ summary }),
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Unable to contact WPS",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 502, headers: corsHeaders },
    );
  }
});
