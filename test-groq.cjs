const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
async function run() {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: "hello" }],
      model: "llama-3.1-8b-instant",
    });
    console.log("Groq Response:", chatCompletion.choices[0]?.message?.content);
  } catch (e) {
    console.error("Groq Error:", e.message);
  }
}
run();
