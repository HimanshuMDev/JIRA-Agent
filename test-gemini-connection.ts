import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

async function testGemini() {
    console.log(`--- Gemini Diagnostic ---`);
    console.log(`Model: ${modelName}`);
    
    if (!apiKey) {
        console.error("❌ GEMINI_API_KEY is not set in .env");
        return;
    }

    const genAI = new GoogleGenAI({ apiKey });

    try {
        console.log(`\nListing all available models for your API key...`);
        const modelList = await genAI.models.list();
        for await (const m of modelList) {
            console.log(`- ${m.name} (v${m.version})`);
        }

        console.log(`\nTesting connection with model: ${modelName}...`);
        const response = await genAI.models.generateContent({
            model: modelName,
            contents: "Say 'Success' if you can read this."
        });

        console.log(`✅ Result: ${response.text}`);
    } catch (error: any) {
        console.error("❌ Gemini Connection Failed!");
        console.error(`- Error: ${JSON.stringify(error.message || error)}`);
        
        if (error.message?.includes('429') || error.status === 'RESOURCE_EXHAUSTED') {
            console.warn("\n⚠️ Quota Exceeded (429). Try switching models in .env");
        }
    }
}

testGemini();
