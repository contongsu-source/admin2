import express from "express";
import path from "path";
import multer from 'multer';
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON
  app.use(express.json({ limit: '10mb' }));

  // API to upload and parse receipt
  app.post("/api/scan-receipt", async (req, res) => {
    try {
      const { base64: base64Data, mimeType } = req.body;
      if (!base64Data) {
        return res.status(400).json({ error: "No receipt data provided." });
      }

      const apiKey = process.env.GEMINI_API_KEY || '';
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key not configured on server (Missing GEMINI_API_KEY env)" });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
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
                  description: "Satuan ukur (contoh: Pcs, Sak, Meter, m3, Rol, Lembar, dll)",
                },
                unitPrice: {
                  type: Type.NUMBER,
                  description: "Harga satu buah barang (tanpa Rp, tanpa pemisah ribuan, cukup angka saja)",
                },
                totalPrice: {
                  type: Type.NUMBER,
                  description: "Total harga untuk barang ini (tanpa Rp, tanpa pemisah ribuan, cukup angka saja. Quantity x unit price)",
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

      return res.json({ items });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Server error handling scan receipt." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
