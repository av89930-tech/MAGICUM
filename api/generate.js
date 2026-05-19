export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { furnitureBase64, furnitureMime, fabricBase64, fabricMime } = req.body;
    if (!furnitureBase64 || !fabricBase64) {
      return res.status(400).json({ success: false, error: 'Missing images' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not set');
      return res.status(500).json({ success: false, error: 'Server misconfiguration: missing API key' });
    }

    const prompt = `Ти — майстер цифрової переоббивки меблів. Завдання: замінити оббивку меблів з першого зображення на тканину, колір і текстуру з другого зображення. Збережи форму, каркас, ніжки, складки, тіні та оточення. Нова оббивка має точно відповідати кольору та візерунку другого зображення. Фотореалістичний результат без артефактів. Поверни тільки зображення.`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: furnitureMime, data: furnitureBase64 } },
            { inline_data: { mime_type: fabricMime, data: fabricBase64 } }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        responseModalities: ["IMAGE", "TEXT"],
        candidateCount: 1
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini API error:', data);
      return res.status(500).json({ success: false, error: data.error?.message || 'Gemini API failed' });
    }

    const parts = data.candidates?.[0]?.content?.parts;
    let imageBase64 = null;
    let mimeType = 'image/jpeg';
    for (const part of parts) {
      if (part.inlineData) {
        imageBase64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType || mimeType;
        break;
      }
    }

    if (!imageBase64) {
      return res.status(500).json({ success: false, error: 'No image in Gemini response' });
    }

    return res.status(200).json({ success: true, imageBase64, mimeType });
  } catch (err) {
    console.error('Function error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}