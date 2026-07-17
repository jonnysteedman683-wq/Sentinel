async function run() {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        messages: [{ role: "user", content: "hello" }],
      }),
    });
    const data = await response.json();
    console.log("OpenRouter data:", JSON.stringify(data));
  } catch (e) {
    console.error("OpenRouter Error:", e.message);
  }
}
run();
