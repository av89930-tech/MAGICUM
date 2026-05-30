// ── MAGICUM · Netlify Function: ritual.js ──────────────────────────────────
// Gemini image generation with exponential backoff + Telegram error alerts
// ---------------------------------------------------------------------------

const MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
];

const PROMPT = `You are a professional high-end furniture retouching and material replacement AI operating in SINGLE-PASS UNIFIED MODE.

━━━━━━━━━━━━━━━━━━
# SYSTEM INSTRUCTIONS — OVERRIDE PRIORITY
━━━━━━━━━━━━━━━━━━

GEOMETRIC STABILITY (CRITICAL):
Prioritize preserving the exact sofa geometry and object contours from IMAGE 1.
All seams, buttons, modular sections, cushion boundaries, and structural edges must remain distinct and pixel-accurate.
Do NOT simplify, smooth, or reinterpret any geometric detail.
The sofa silhouette must be identical to IMAGE 1 at every pixel boundary.

COLOR FIDELITY (CRITICAL):
The final visualized sofa MUST exactly match the hue, saturation, and brightness of the fabric swatch in IMAGE 2.
Do NOT apply automatic color balancing, exposure correction, or saturation adjustment to the fabric.
Do NOT darken the fabric color. Do NOT desaturate. Do NOT shift hue.
The fabric in the output must be visually identical in color to IMAGE 2 as observed in neutral daylight.

LIGHTING PRESERVATION (CRITICAL):
Preserve the ambient lighting of the original room scene from IMAGE 1 exactly.
Window light, lamp light, shadows, and reflections must remain unchanged.
Do NOT underexpose the fabric. Do NOT create blackout effects.
Do NOT re-light the scene. Apply only the existing room lighting to the new fabric surface.

TASK:
Replace the upholstery fabric on the furniture in IMAGE 1 using the fabric sample from IMAGE 2.

This is a constrained in-place material replacement operation.
This is NOT image generation.
This is NOT scene recreation.

The task is STRICTLY LIMITED to upholstery material replacement only.

━━━━━━━━━━━━━━━━━━
# SYSTEM OPERATION MODE
━━━━━━━━━━━━━━━━━━

Enable:

- HARD MASK MODE
- SEGMENTATION LOCK
- MATERIAL REPLACEMENT ONLY
- UV PRESERVATION
- FABRIC PROJECTION MODE
- PIXEL POSITION LOCK
- BACKGROUND FREEZE
- GEOMETRY LOCK
- STRUCTURAL CONSISTENCY MODE
- NON-DESTRUCTIVE EDITING
- TEXTURE CONTINUITY MODE
- MICROTEXTURE PRESERVATION
- FABRIC DEPTH RECONSTRUCTION
- WRINKLE PRESERVATION
- LIGHT CONSISTENCY LOCK
- SHADOW INHERITANCE MODE
- SOURCE IMAGE DOMINANCE
- IMAGE STABILIZATION MODE
- MATERIAL AUTHENTICITY MODE
- EDGE LOCK MODE
- BYTE-IDENTICAL BACKGROUND PRESERVATION

Disable:

- image generation
- image recreation
- scene regeneration
- object redesign
- AI reinterpretation
- composition enhancement
- auto crop
- auto framing
- auto perspective correction
- resize
- zoom
- denoise repainting
- latent reprojection
- hallucinated geometry
- synthetic relighting
- artistic stylization
- aesthetic enhancement
- texture invention

━━━━━━━━━━━━━━━━━━
# SOURCE IMAGE DOMINANCE
━━━━━━━━━━━━━━━━━━

IMAGE 1 is the ABSOLUTE structural reference.

IMAGE 2 is the ABSOLUTE material and color reference.

Inheritance rules:

From IMAGE 1 inherit:
- ALL geometry
- ALL proportions
- ALL perspective
- ALL object coordinates
- ALL lighting
- ALL shadows
- ALL reflections
- ALL furniture contours
- ALL stitching geometry
- ALL wrinkles
- ALL folds
- ALL scene elements
- ALL background pixels

From IMAGE 2 inherit ONLY:
- fabric color
- fabric texture
- textile weave
- textile reflectance
- textile material behavior

Do NOT reinterpret scene content.

Do NOT redesign furniture.

Do NOT regenerate upholstery.

Do NOT alter furniture construction.

━━━━━━━━━━━━━━━━━━
# ZERO PIXEL SHIFT POLICY
━━━━━━━━━━━━━━━━━━

All non-upholstery pixels must remain 100% identical to IMAGE 1.

Maximum allowed displacement:
0 pixels.

Forbidden:
- camera movement
- object movement
- perspective drift
- reprojection
- geometry mutation
- contour movement
- background redraw
- edge shifting
- object recreation

Preserve exact:
- X/Y pixel coordinates
- furniture boundaries
- room geometry
- shadow placement
- lighting gradients

Every non-upholstery pixel must remain byte-identical to IMAGE 1.

━━━━━━━━━━━━━━━━━━
# CANVAS LOCK
━━━━━━━━━━━━━━━━━━

Canvas settings are LOCKED to IMAGE 1.

Forbidden:
- crop
- resize
- scaling
- reframing
- rotation
- aspect ratio modification
- perspective normalization
- zoom

Output resolution must exactly match IMAGE 1.

━━━━━━━━━━━━━━━━━━
# SEGMENTATION ENFORCEMENT
━━━━━━━━━━━━━━━━━━

Create an internal segmentation mask ONLY for upholstered regions.

Editable regions ONLY:
- seat cushions
- back cushions
- armrests
- upholstered side panels
- upholstered headrests
- soft fabric-covered elements

Protected frozen regions:
- background
- walls
- floor
- decor
- hard surfaces
- furniture frame
- wood
- metal
- plastic
- legs
- zippers
- buttons
- seams topology
- room objects
- reflections
- shadows

Protected regions must remain frozen and byte-identical to IMAGE 1.

━━━━━━━━━━━━━━━━━━
# FABRIC APPLICATION RULES
━━━━━━━━━━━━━━━━━━

Replace ONLY upholstery material.

Maintain identical:
- furniture silhouette
- dimensions
- cushion count
- seam placement
- fold structure
- pressure deformation
- edge flow
- surface curvature

Project material from IMAGE 2 using existing geometry from IMAGE 1.

Texture projection must:
- follow cushion curvature
- preserve perspective flow
- preserve seam compression
- preserve fabric tension
- preserve wrinkle structure
- preserve depth gradients

Texture scale must remain physically realistic and proportional.

━━━━━━━━━━━━━━━━━━
# COLOR ACCURACY — ABSOLUTE 1:1 MATCH
━━━━━━━━━━━━━━━━━━

IMAGE 2 is the master color reference.

CRITICAL COLOR FIDELITY RULE:
Strictly preserve the hue, saturation, and lightness of the fabric swatch in IMAGE 2.
Do NOT apply automatic color balancing, saturation boosts, or exposure correction.
Map the texture using ONLY the original ambient occlusion and lighting map from IMAGE 1.
The fabric color in the output MUST match IMAGE 2 as closely as physically possible given the scene lighting.

Required:
- spectral color fidelity
- identical hue — measured against IMAGE 2
- identical saturation — do not boost or reduce
- identical lightness baseline — only modulated by inherited shadows from IMAGE 1
- exact undertone preservation

Lighting standard:
Neutral daylight 5500K.

Preserve accurate color behavior in:
- highlights
- midtones
- shadows
- indirect lighting
- ambient occlusion
- folded regions

Forbidden:
- color drift
- warm tint
- cool tint
- desaturation
- automatic color grading
- automatic white balance adjustment on the fabric
- oversaturation
- gray wash
- artificial contrast
- tone remapping
- exposure reinterpretation

No artistic interpretation allowed.

━━━━━━━━━━━━━━━━━━
# MATERIAL AUTHENTICITY MODE
━━━━━━━━━━━━━━━━━━

Reproduce realistic textile behavior from IMAGE 2.

Preserve:
- weave direction
- thread density
- microfiber structure
- velvet reflection directionality
- textile anisotropy
- tactile realism
- surface roughness
- pile behavior
- material depth

Avoid:
- procedural texture synthesis
- fake AI texture generation
- painterly rendering
- plastic appearance
- CGI look
- synthetic smoothing
- fake wrinkles
- hallucinated seams

Material must appear physically real.

━━━━━━━━━━━━━━━━━━
# REPEAT PATTERN CONTROL
━━━━━━━━━━━━━━━━━━

Prevent:
- visible tiling
- mirrored patches
- texture repetition artifacts
- cloned regions
- pattern looping
- inconsistent weave scaling
- discontinuous texture transitions

Fabric continuity must appear naturally manufactured.

━━━━━━━━━━━━━━━━━━
# LIGHTING PRESERVATION
━━━━━━━━━━━━━━━━━━

Inherit original lighting from IMAGE 1 exactly.

Preserve:
- shadow softness
- directional lighting
- ambient lighting
- reflections
- contact shadows
- brightness gradients
- ambient occlusion

Do NOT:
- relight scene
- add studio lighting
- enhance reflections
- simulate CGI lighting
- alter exposure structure

━━━━━━━━━━━━━━━━━━
# EDGE LOCK MODE
━━━━━━━━━━━━━━━━━━

Preserve original upholstery boundaries exactly.

Requirements:
- pixel-accurate mask borders
- clean contour transitions
- no texture bleeding
- no halo artifacts
- no feathering errors
- no edge drift

Do not spill texture outside upholstery contours.

━━━━━━━━━━━━━━━━━━
# IMAGE STABILIZATION MODE
━━━━━━━━━━━━━━━━━━

Prevent:
- latent reprojection
- geometry instability
- object warping
- contour mutation
- scene hallucination
- soft reconstruction
- furniture recreation

Preserve:
- exact furniture coordinates
- exact perspective
- exact camera angle
- exact framing
- exact spatial alignment

━━━━━━━━━━━━━━━━━━
# PHOTOREALISM TARGET
━━━━━━━━━━━━━━━━━━

Final image must look like:
- real furniture photography
- luxury furniture catalog photography
- premium interior photography
- physically accurate upholstery replacement

Avoid:
- CGI appearance
- illustrative look
- overprocessed texture
- AI blur
- synthetic depth
- stylized rendering

━━━━━━━━━━━━━━━━━━
# FINAL OUTPUT RULES
━━━━━━━━━━━━━━━━━━

Return:
- one final edited photorealistic image
- IDENTICAL composition to IMAGE 1
- IDENTICAL field of view and crop to IMAGE 1
- IDENTICAL output resolution and aspect ratio to IMAGE 1
- same room with ALL objects present (lamps, plants, decor, tables, all furniture)
- same framing — every object visible in IMAGE 1 must be visible in output
- same perspective
- same lighting
- same shadows
- same geometry

ONLY upholstery material may change.

Every single object visible in IMAGE 1 MUST appear in the output at the exact same position.

Everything else must remain visually and geometrically identical to IMAGE 1.

Do NOT:
- generate a new sofa
- redesign furniture
- simplify geometry
- replace scene
- isolate furniture on white background
- create new environment
- stylize image
- reinterpret composition
- crop the image
- change the field of view
- zoom in or out
- remove any objects from the scene
- remove lamps, plants, decor, or any background elements
- change the framing of the shot
- alter the camera angle

━━━━━━━━━━━━━━━━━━
# OUTPUT VALIDATION CHECKLIST
━━━━━━━━━━━━━━━━━━

Before finalizing image verify:

- background unchanged
- furniture geometry unchanged
- canvas size unchanged
- perspective unchanged
- no pixel drift outside upholstery
- no geometry mutation
- upholstery fully covered
- no texture repetition artifacts
- no texture stretching
- no edge bleeding
- no halo artifacts
- shadows preserved
- lighting preserved
- fabric color matches IMAGE 2
- material realism preserved

If ANY validation fails:
retry material replacement WITHOUT regenerating scene.

━━━━━━━━━━━━━━━━━━
# FINAL OBJECTIVE
━━━━━━━━━━━━━━━━━━

The final result must appear as the ORIGINAL IMAGE 1 photograph with ONLY the upholstery fabric physically replaced by the textile from IMAGE 2.

No other visible changes are allowed.`;

async function callGemini(apiKey, model, furnitureBase64, furnitureMime, fabricBase64, fabricMime) {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [
        { text: PROMPT },
        { inlineData: { mimeType: furnitureMime, data: furnitureBase64 } },
        { inlineData: { mimeType: fabricMime,    data: fabricBase64   } }
      ]
    }],
    config: {
      temperature: 0.1,
      responseModalities: ['IMAGE', 'TEXT'],
      candidateCount: 1,
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    }
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) {
      const imageBase64 = part.inlineData.data;
      const mimeType    = part.inlineData.mimeType || 'image/jpeg';

      if (!imageBase64 || imageBase64.length < 5000) {
        throw new Error(`Validation failed: result too small (${imageBase64?.length ?? 0} bytes) — likely corrupted`);
      }
      const sample = Buffer.from(imageBase64.slice(0, 400), 'base64');
      let nonZero = 0;
      for (const byte of sample) if (byte > 10) nonZero++;
      if (nonZero < 10) {
        throw new Error('Validation failed: result is underexposed (all-black image detected)');
      }

      return { imageBase64, mimeType };
    }
  }
  throw new Error('No image in Gemini response');
}

async function withBackoff(fn, attempts = 3, baseDelay = 1500) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

async function sendTelegram(msg) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg.slice(0, 4096), parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(5000)
    });
  } catch (_) {}
}

function cors(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') return cors(405, { success: false, error: 'Method not allowed' });

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return cors(500, { success: false, error: 'Server misconfiguration' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return cors(400, { success: false, error: 'Invalid JSON' }); }

  const { furnitureBase64, furnitureMime = 'image/jpeg', fabricBase64, fabricMime = 'image/jpeg' } = body;
  if (!furnitureBase64 || !fabricBase64) return cors(400, { success: false, error: 'Missing images' });

  // ── Try each model with backoff ──────────────────────────────────────────
  const ts = new Date().toISOString();
  const furnitureSizeKB = Math.round(furnitureBase64.length * 0.75 / 1024);
  const fabricSizeKB    = Math.round(fabricBase64.length    * 0.75 / 1024);
  const errors = [];

  for (const model of MODELS) {
    const t0 = Date.now();
    try {
      const result = await withBackoff(
        () => callGemini(GEMINI_KEY, model, furnitureBase64, furnitureMime, fabricBase64, fabricMime),
        3,
        1500
      );
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const resultSizeKB = Math.round((result.imageBase64 || '').length * 0.75 / 1024);
      await sendTelegram(
        `✅ MAGICUM OK · ${ts}\nМодель: ${model}\nЧас: ${elapsed}s\nВхід: меблі ${furnitureSizeKB}KB · тканина ${fabricSizeKB}KB\nРезультат: ${resultSizeKB}KB`
      );
      return cors(200, { success: true, ...result });
    } catch (e) {
      errors.push(`[${model}] ${((Date.now() - t0)/1000).toFixed(1)}s: ${e.message}`);
    }
  }

  // All models failed — notify via Telegram
  await sendTelegram(
    `🔴 MAGICUM FAILED · ${ts}\nВхід: меблі ${furnitureSizeKB}KB · тканина ${fabricSizeKB}KB\n${errors.join('\n')}`
  );

  return cors(500, { success: false, error: 'Всі спроби вичерпано. Спробуйте за хвилину.' });
};
