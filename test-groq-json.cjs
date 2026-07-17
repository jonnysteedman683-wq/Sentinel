const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
async function run() {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant. Respond with a valid JSON object containing a greeting." },
        { role: "user", content: "hello" }
      ],
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" }
    });
    console.log("Groq JSON Response:", chatCompletion.choices[0]?.message?.content);
  } catch (e) {
    console.error("Groq JSON Error:", e.message);
  }
}
run();
