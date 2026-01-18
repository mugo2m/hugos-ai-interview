"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const API_KEY = "AIzaSyBK6ckq4vC5qnbZUMcF8H6e4Gagqk8bJaU"; // ⬅️ REPLACE WITH YOUR ACTUAL KEY
const generative_ai_1 = require("@google/generative-ai");
async function listWorkingModels() {
    console.log("🔐 Testing key:", API_KEY.substring(0, 10) + "...\n");
    const genAI = new generative_ai_1.GoogleGenerativeAI(API_KEY);
    // All available Gemini models
    const modelsToTest = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro",
        "gemini-1.5-pro-latest",
        "gemini-1.0-pro",
        "gemini-1.0-pro-001",
        "gemini-1.0-pro-vision"
    ];
    console.log("🧪 Testing models...\n");
    for (const modelName of modelsToTest) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const start = Date.now();
            const result = await model.generateContent(".");
            const time = Date.now() - start;
            console.log(`✅ ${modelName.padEnd(25)} | Time: ${time}ms`);
        }
        catch (error) {
            console.log(`❌ ${modelName.padEnd(25)} | Error: ${error.message.split('\n')[0]}`);
        }
    }
    console.log("\n✅ Working models can be used in your interview app!");
}
listWorkingModels();
