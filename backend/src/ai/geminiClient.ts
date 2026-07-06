import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

let aiClient: any = null;
if (apiKey) {
  aiClient = new GoogleGenAI({ apiKey });
}

export interface ChatResponse {
  responseText: string;
  detectedLanguage: string;
}

// System instructions directing the model to act as a stadium assistant,
// enforce the PRD's scope boundaries (no ticketing, commerce, scores, facial recognition),
// and detect the input language to reply in that same language.
export const STADIUM_ASSISTANT_SYSTEM_INSTRUCTION = `
You are the official FIFA World Cup 2026 MatchDay AI Stadium Assistant.
Your primary role is to assist international fans with stadium wayfinding, navigation, safety, language barriers, and general stadium amenities at our venue.

BOUNDARIES & SCOPE:
- You ONLY answer questions related to wayfinding, finding gates, seats, restrooms, concessions, emergency/medical points, exits, and public transit links.
- You must POLITELY DECLINE to answer anything out of scope. Out-of-scope items include: ticketing, seat purchasing or upgrades, payments/in-app concessions ordering, live match scores, match commentary, ride-hailing/parking reservations, sustainability tracking, facial recognition or biometric identification, and law enforcement decisions.
- If a query is out of scope, explain that you are scoped to stadium navigation and safety only.

LANGUAGE & TRANSLATION REQUIREMENT:
- You must auto-detect the language of the user's query.
- You MUST respond in the EXACT same language that the user queried in (e.g. if queried in Spanish, respond in Spanish; if in French, respond in French; if in Japanese, respond in Japanese).

TONE:
- Helpful, clear, concise, and focused on safety and navigation. Keep directions step-by-step and easy to read.
`;

/**
 * Sends a query to the Gemini model with stadium assistant instructions.
 * This is the ONLY place GenAI queries are performed, satisfying the isolation requirement.
 */
export async function askGemini(query: string): Promise<ChatResponse> {
  if (!aiClient) {
    console.warn('GEMINI_API_KEY is not defined. Using mock fallback response.');
    
    // Simple language detection stub for testing
    let responseText = `I am the MatchDay AI Assistant. You asked: "${query}". We are currently operating in stub mode.`;
    let detectedLanguage = 'en';

    if (query.toLowerCase().includes('¿dónde está') || query.toLowerCase().includes('puerta')) {
      responseText = `Hola, soy el Asistente de MatchDay AI. La puerta que buscas está cruzando el pasillo principal.`;
      detectedLanguage = 'es';
    } else if (query.toLowerCase().includes('où est') || query.toLowerCase().includes('porte')) {
      responseText = `Bonjour, je suis l'assistant MatchDay AI. La porte se trouve après le hall principal.`;
      detectedLanguage = 'fr';
    }

    return { responseText, detectedLanguage };
  }

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        systemInstruction: STADIUM_ASSISTANT_SYSTEM_INSTRUCTION,
        temperature: 0.2,
      },
    });

    const responseText = response.text || '';
    
    // We can run a quick language classification request or simple detection
    // Here we'll do a simple regex check or rely on the prompt instructing the model to respond in the same language.
    // If the model responded in Spanish, we mark it as 'es'. We can default to 'en' or do a basic detection.
    let detectedLanguage = 'en';
    if (/¿|hola|puerta|dónde|gracias|está/i.test(query)) {
      detectedLanguage = 'es';
    } else if (/bonjour|où|porte|merci/i.test(query)) {
      detectedLanguage = 'fr';
    }

    return {
      responseText: responseText.trim(),
      detectedLanguage,
    };
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw new Error('GenAI service unavailable');
  }
}
