import express from "express";
import http from "http";
import path from "path";
import multer from 'multer';
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = 3000;

  // Middleware to parse JSON
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
        model: "gemini-2.5-flash",
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

  // API to upload and parse petty cash receipt
  app.post("/api/scan-pettycash", async (req, res) => {
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

      return res.json({ data });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ error: error.message || "Server error handling scan receipt." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
