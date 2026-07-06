"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.askGemini = askGemini;
const genai_1 = require("@google/genai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const apiKey = process.env.GEMINI_API_KEY;
// Initialize the Gemini client if the API key is provided
let aiClient = null;
if (apiKey) {
    aiClient = new genai_1.GoogleGenAI({ apiKey });
}
/**
 * Generates a response using Google AI Studio (Gemini).
 * This function isolates all GenAI calls as required by code quality guidelines.
 *
 * @param query The sanitized query string from the user.
 * @param systemInstruction Directives instructing Gemini how to act.
 * @returns A promise resolving to the chat response.
 */
async function askGemini(query, systemInstruction) {
    if (!aiClient) {
        console.warn('GEMINI_API_KEY is not defined. Returning stub response.');
        return {
            responseText: `[Stub Response] Answer to: "${query}" (English stub)`,
            detectedLanguage: 'en',
        };
    }
    try {
        // Under the `@google/genai` SDK:
        const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: query,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.2,
            }
        });
        const text = response.text || '';
        // Simple language detection logic can be added/refined later
        return {
            responseText: text.trim(),
            detectedLanguage: 'en', // Will be detected or returned via model output schema
        };
    }
    catch (error) {
        console.error('Error calling Gemini API:', error);
        throw new Error('GenAI service unavailable');
    }
}
