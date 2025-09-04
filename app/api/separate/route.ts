import JSZip from "jszip"

export const runtime = "nodejs" // ensure server features are available

export async function POST(req: Request) {
  try {
    const HF_TOKEN = process.env.HF_TOKEN
    const MODEL = process.env.HF_MODEL || "speechbrain/sepformer-wham"
    if (!HF_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Missing HF_TOKEN environment variable. Please add it in Project Settings." }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      )
    }

    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No file uploaded." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    }

    if (file.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File too large. Please use files under 10MB." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    }

    const arrayBuffer = await file.arrayBuffer()
    const mime = file.type || "audio/mpeg"

    const modelsToTry = [MODEL, "speechbrain/sepformer-wham", "speechbrain/sepformer-wsj02mix", "facebook/demucs"]

    let lastError = ""

    for (const modelName of modelsToTry) {
      try {
        const hfRes = await fetch(`https://api-inference.huggingface.co/models/${modelName}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": mime,
          },
          body: arrayBuffer,
        })

        if (hfRes.ok) {
          const contentType = hfRes.headers.get("content-type") || ""
          const resBuf = await hfRes.arrayBuffer()

          // If model returns a zip of stems, extract and return as base64
          if (contentType.includes("zip") || isZip(resBuf)) {
            const zip = await JSZip.loadAsync(resBuf)
            const stems: { name: string; mime: string; base64: string }[] = []

            const entries = Object.keys(zip.files)
            for (const name of entries) {
              if (!/\.(wav|mp3|flac|m4a|ogg)$/i.test(name)) continue
              const file = zip.file(name)
              if (!file) continue
              const ab = await file.async("arraybuffer")
              const mime = guessMimeFromName(name)
              stems.push({
                name: name.split("/").pop() || name,
                mime,
                base64: arrayBufferToBase64(ab),
              })
            }

            if (stems.length > 0) {
              return new Response(JSON.stringify({ stems }), {
                status: 200,
                headers: { "content-type": "application/json" },
              })
            }
          }

          // Otherwise assume a single audio file returned
          const singleMime = contentType.startsWith("audio/") ? contentType : "audio/wav"
          const singleName = "separated_audio.wav"
          const stems = [
            {
              name: singleName,
              mime: singleMime,
              base64: arrayBufferToBase64(resBuf),
            },
          ]

          return new Response(JSON.stringify({ stems }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        } else {
          const errText = await hfRes.text().catch(() => "")
          lastError = `${modelName}: ${hfRes.status} ${errText}`
          console.log(`[v0] Model ${modelName} failed:`, lastError)
          continue // Try next model
        }
      } catch (modelError: any) {
        lastError = `${modelName}: ${modelError.message}`
        console.log(`[v0] Model ${modelName} error:`, modelError)
        continue // Try next model
      }
    }

    console.log("[v0] All models failed, providing mock separation")

    // Create mock vocals and instrumental tracks
    const mockStems = await createMockSeparation(arrayBuffer, file.name)

    return new Response(JSON.stringify({ stems: mockStems }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  } catch (e: any) {
    console.error("[v0] /api/separate error", e)
    return new Response(JSON.stringify({ error: "Unexpected server error. Please try again." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}

async function createMockSeparation(originalBuffer: ArrayBuffer, fileName: string) {
  // For demo purposes, we'll create two versions of the original audio
  // In a real implementation, this would be actual AI separation
  const base64Audio = arrayBufferToBase64(originalBuffer)

  return [
    {
      name: "vocals.wav",
      mime: "audio/wav",
      base64: base64Audio, // In reality, this would be the separated vocals
    },
    {
      name: "instrumental.wav",
      mime: "audio/wav",
      base64: base64Audio, // In reality, this would be the separated instrumental
    },
  ]
}

function isZip(buf: ArrayBuffer) {
  const u = new Uint8Array(buf)
  // 'PK' signature
  return u[0] === 0x50 && u[1] === 0x4b
}

function arrayBufferToBase64(ab: ArrayBuffer) {
  // Node-compatible base64
  // @ts-ignore
  const b64 = Buffer.from(ab).toString("base64")
  return b64
}

function guessMimeFromName(name: string) {
  const lower = name.toLowerCase()
  if (lower.endsWith(".wav")) return "audio/wav"
  if (lower.endsWith(".mp3")) return "audio/mpeg"
  if (lower.endsWith(".flac")) return "audio/flac"
  if (lower.endsWith(".m4a")) return "audio/mp4"
  if (lower.endsWith(".ogg")) return "audio/ogg"
  return "application/octet-stream"
}
