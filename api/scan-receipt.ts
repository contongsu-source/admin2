import { GoogleGenAI, Type } from "@google/genai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

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

    const prompt = `Extrak data material bangunan dari foto nota ini. Aku butuh data per baris item dengan kolom: nama item, quantity (jumlah), satuan ukur (e.g., pcs, sack, m, kg, m3, galon, dsb), harga satuan, dan harga total (terkadang nota ada diskon per item tapi ambil total aja untuk baris itu). 
Jika qty tidak terbaca, asumsikan 1.
Jika satuan tidak terbaca, pilih unit yang logis atau kosongkan.
Jika harga total kosong asumsikan qty * harga satuan, pastikan harga dan qty adalah angka yang masuk akal tanpa format IDR/Rp.
Abaikan baris total keseluruhan atau ongkos kirim.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              itemName: {
                type: Type.STRING,
                description: "Nama barang",
              },
              quantity: {
                type: Type.NUMBER,
                description: "Jumlah barang",
              },
              unit: {
                type: Type.STRING,
                description: "Satuan ukur",
              },
              unitPrice: {
                type: Type.NUMBER,
                description: "Harga satu",
              },
              totalPrice: {
                type: Type.NUMBER,
                description: "Harga total",
              }
            },
            required: ["itemName", "quantity", "unit", "unitPrice", "totalPrice"],
          },
        },
      },
    });

    const jsonStr = response.text?.trim() || "[]";
    let items = [];
    try {
      items = JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse JSON", e, jsonStr);
      return res.status(500).json({ error: "Failed to parse AI output." });
    }

    return res.status(200).json({ items });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message || "Server error handling scan receipt." });
  }
}
