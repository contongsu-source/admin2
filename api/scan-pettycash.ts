import { GoogleGenAI, Type } from "@google/genai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export const maxDuration = 60; // Set max execution time for Vercel to 60 seconds

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { base64: base64Data, mimeType } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: "No receipt data provided." });
    }

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key not configured on server (Missing GEMINI_API_KEY env di Vercel)" });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build-vercel',
        }
      }
    });

    const imagePart = {
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: base64Data,
      },
    };

    const prompt = `Ekstrak data dari foto nota/struk belanja ini untuk pencatatan kas kecil (pengeluaran). Aku butuh total nilai pengeluaran dan deskripsi mendetail tentang nota ini.
Jika ada informasi jumlah (quantity) dan satuan (misalnya liter, pcs, box) pada item, sertakan dalam deskripsi (contoh: "Beli Bensin 10 Liter", "Makan Siang 3 Porsi", "Semen 5 Sak", "Kertas HVS 2 Rim").
Pastikan total pengeluaran adalah angka yang valid tanpa format IDR/Rp.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: {
              type: Type.STRING,
              description: "Deskripsi mendetail pengeluaran termasuk jumlah dan satuan jika ada (misal: Beli Kopi 2 Cup, Bensin 10 Liter, Paku 2 Kg)",
            },
            amount: {
              type: Type.NUMBER,
              description: "Total harga pengeluaran (hanya angka, tanpa Rp)",
            }
          },
          required: ["description", "amount"],
        },
      },
    });

    const jsonStr = response.text?.trim() || "{}";
    let data = {};
    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON", e, jsonStr);
      return res.status(500).json({ error: "Failed to parse AI output." });
    }

    return res.status(200).json({ data });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message || "Server error handling scan receipt." });
  }
}
