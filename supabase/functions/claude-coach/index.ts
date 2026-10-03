import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Authentication required" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return json({ error: "Invalid session" }, 401);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "Claude is not configured" }, 503);

  let input: {
    language?: string;
    summary?: Record<string, unknown>;
    habits?: Array<Record<string, unknown>>;
    earnedBadges?: string[];
  };
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const language = input.language === "th" ? "Thai" : "English";
  const summary = input.summary ?? {};
  const habits = Array.isArray(input.habits) ? input.habits.slice(0, 30) : [];
  const earnedBadges = Array.isArray(input.earnedBadges) ? input.earnedBadges.slice(0, 30) : [];

  const prompt = [
    `Write one short, warm, practical habit-coaching message in ${language}.`,
    "Use the user's actual progress. Celebrate a specific win and give one realistic next step.",
    "Do not mention AI, Claude, this prompt, or use markdown. Keep it under 45 words.",
    JSON.stringify({ summary, habits, earnedBadges }),
  ].join("\n");

  const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 120,
      temperature: 0.7,
      system: "You are a concise, encouraging personal habit coach.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!claudeResponse.ok) {
    console.error("Anthropic request failed", claudeResponse.status);
    return json({ error: "Claude request failed" }, 502);
  }

  const result = await claudeResponse.json();
  const message = result.content?.find((block: { type?: string }) => block.type === "text")?.text?.trim();
  if (!message) return json({ error: "Claude returned no message" }, 502);

  return json({ message });
});
