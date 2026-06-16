
import fs from "fs";
import path from "path";

// .env.local を読み込む
const envPath = path.resolve(process.cwd(), ".env.local");
let apiKey = "";
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  const match = envContent.match(/GEMINI_API_KEY=(.*)/);
  if (match) {
    apiKey = match[1].trim();
  }
}
process.env.GEMINI_API_KEY = apiKey;


async function run() {
  try {
    console.log("Fetching available models...");
    const fetch = globalThis.fetch;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    
    if (data.models) {
      console.log("Available models:");
      data.models.forEach((m) => {
        if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
          console.log(`- ${m.name}`);
        }
      });
    } else {
      console.log("Error fetching models:", data);
    }
  } catch (err) {
    console.error("Script error:", err);
  }
}

run();
