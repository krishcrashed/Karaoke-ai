"use client"

import type React from "react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import ProcessingSteps from "@/components/processing-steps"
import PulsingLights from "@/components/pulsing-lights"

// Colors: black (#0b0b0f), purple (#8b5cf6), pink (#ec4899), white (#ffffff)

type StemFile = {
  name: string
  mime: string
  base64: string
}

type SeparateResponse = { stems: StemFile[] } | { error: string }

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentStep, setCurrentStep] = useState<number>(0)
  const [vocalsUrl, setVocalsUrl] = useState<string | null>(null)
  const [instrumentalUrl, setInstrumentalUrl] = useState<string | null>(null)
  const [downloadNames, setDownloadNames] = useState<{ vocals: string; instrumental: string }>({
    vocals: "vocals.wav",
    instrumental: "instrumental.wav",
  })

  const steps = useMemo(
    () => ["Uploading audio", "Estimating stems", "Separating sources (AI)", "Rendering outputs"],
    [],
  )

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    const f = e.target.files?.[0]
    if (!f) return
    const okTypes = [
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/flac",
      "audio/mp4",
      "audio/x-m4a",
      "audio/aac",
      "audio/ogg",
      "audio/webm",
    ]
    if (!okTypes.includes(f.type)) {
      // Accept anyway; server will try best-effort
      console.log("[v0] Uncommon mime type selected:", f.type)
    }
    setFile(f)
  }

  function removeFile() {
    setFile(null)
    setError(null)
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) fileInput.value = ""
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setError("Please choose an audio file first.")
      return
    }
    setIsProcessing(true)
    setCurrentStep(0)
    setError(null)
    setVocalsUrl(null)
    setInstrumentalUrl(null)

    // Step animation loop
    let stepIdx = 0
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1)
      setCurrentStep(stepIdx)
    }, 1800)

    try {
      const form = new FormData()
      form.set("file", file)

      const res = await fetch("/api/separate", {
        method: "POST",
        body: form,
      })

      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || "Separation failed")
      }

      const data = (await res.json()) as SeparateResponse
      if ("error" in data) throw new Error(data.error)

      // Find vocals and accompaniment if provided; otherwise assemble accompaniment from non-vocals
      const { vocalsBlob, instrumentalBlob, vocalsName, instrumentalName } = await prepareOutputs(data.stems)

      const vocalsUrlObj = URL.createObjectURL(vocalsBlob)
      const instrumentalUrlObj = URL.createObjectURL(instrumentalBlob)
      setVocalsUrl(vocalsUrlObj)
      setInstrumentalUrl(instrumentalUrlObj)
      setDownloadNames({
        vocals: vocalsName,
        instrumental: instrumentalName,
      })
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Something went wrong.")
    } finally {
      clearInterval(stepTimer)
      setCurrentStep(steps.length - 1)
      setIsProcessing(false)
    }
  }

  return (
    <main className="relative min-h-dvh bg-[#0b0b0f] text-white overflow-hidden">
      <PulsingLights />
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-12 md:py-16">
        <header className="mb-8 md:mb-10 text-center">
          <h1 className={cn("text-3xl md:text-5xl font-semibold text-balance")}>AI Vocals Remover</h1>
          <p className="mt-3 text-sm md:text-base text-white/80 text-pretty">
            Upload a song and get two tracks: Vocals and Instrumental. Powered by Demucs on Hugging Face.
          </p>
        </header>

        <Card className="bg-black/40 backdrop-blur border-white/10">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Upload audio</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    aria-label="Upload audio file"
                    type="file"
                    accept="audio/*"
                    onChange={onFileChange}
                    className="block flex-shrink-0 border border-white/10 bg-black/50 px-3 py-2 text-sm file:mr-4 file:rounded file:border-0 file:bg-[#8b5cf6] file:px-3 file:py-2 file:text-white hover:file:bg-[#7c3aed] focus:outline-none rounded-lg"
                  />

                  {file && (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <svg
                        className="h-4 w-4 text-[#8b5cf6] flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                      <span className="text-sm text-white/90 truncate">{file.name}</span>
                      <span className="text-xs text-white/60 flex-shrink-0">
                        ({(file.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-colors flex-shrink-0"
                        aria-label="Remove file"
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white"
                disabled={!file || isProcessing}
              >
                {isProcessing ? "Processing…" : "Separate Vocals"}
              </Button>
              {error && (
                <p role="alert" className="text-sm text-red-400">
                  {error}
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        <section aria-live="polite" className="mt-8">
          <ProcessingSteps steps={steps} currentStep={isProcessing ? currentStep : steps.length - 1} />
        </section>

        {(vocalsUrl || instrumentalUrl) && (
          <section className="mt-10 grid gap-6">
            <Card className="bg-black/40 backdrop-blur border-white/10">
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Results</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6">
                {vocalsUrl && (
                  <div>
                    <h3 className="font-medium mb-2 text-[#ec4899]">Vocals</h3>
                    <audio controls src={vocalsUrl} className="w-full" />
                    <a
                      href={vocalsUrl}
                      download={downloadNames.vocals}
                      className="mt-2 inline-block text-sm underline decoration-[#8b5cf6] underline-offset-4 hover:text-[#8b5cf6]"
                    >
                      Download vocals
                    </a>
                  </div>
                )}
                {instrumentalUrl && (
                  <div>
                    <h3 className="font-medium mb-2 text-[#8b5cf6]">Instrumental</h3>
                    <audio controls src={instrumentalUrl} className="w-full" />
                    <a
                      href={instrumentalUrl}
                      download={downloadNames.instrumental}
                      className="mt-2 inline-block text-sm underline decoration-[#ec4899] underline-offset-4 hover:text-[#ec4899]"
                    >
                      Download instrumental
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        <footer className="mt-12 text-center text-xs text-white/60">
          Note: Large files may take longer. Ensure you’ve set the HF_TOKEN in Project Settings.
        </footer>
      </div>
    </main>
  )
}

// Utility: create Blob from base64
function base64ToBlob(b64: string, mime: string) {
  const byteChars = atob(b64)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mime })
}

// Try to pick vocals and accompaniment; if accompaniment is missing, mix non-vocals into one buffer on client
async function prepareOutputs(stems: StemFile[]) {
  const lowerName = (s: StemFile) => s.name.toLowerCase()

  // Find vocals directly
  let vocals = stems.find((s) => /vocals?/.test(lowerName(s)))
  // Try alternative naming
  if (!vocals) vocals = stems.find((s) => /(vocal|singer|voice)/.test(lowerName(s)))

  // Find direct accompaniment if present
  const accompaniment = stems.find((s) => /(accompaniment|no[_-]?vocals|instrumental)/.test(lowerName(s)))

  if (vocals && accompaniment) {
    return {
      vocalsBlob: base64ToBlob(vocals.base64, vocals.mime),
      instrumentalBlob: base64ToBlob(accompaniment.base64, accompaniment.mime),
      vocalsName: vocals.name,
      instrumentalName: accompaniment.name,
    }
  }

  // Otherwise, mix non-vocals stems on client
  const nonVocalStems = stems.filter((s) => s !== vocals && !/(vocals?)/.test(lowerName(s)))
  if (!vocals && nonVocalStems.length === 0) {
    // Fall back: if service returned only one file, use it as instrumental
    const only = stems[0]
    return {
      vocalsBlob: new Blob([], { type: "audio/wav" }),
      instrumentalBlob: base64ToBlob(only.base64, only.mime),
      vocalsName: "vocals.wav",
      instrumentalName: only.name || "instrumental.wav",
    }
  }

  // Decode and mix with OfflineAudioContext
  const ctx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(2, 44100 * 120, 44100) // up to 2 minutes default; will resize later based on decoded buffers

  const decodedBuffers: AudioBuffer[] = []
  for (const s of nonVocalStems) {
    const blob = base64ToBlob(s.base64, s.mime)
    const arr = await blob.arrayBuffer()
    try {
      const buf = await decodeAudio(arr)
      decodedBuffers.push(buf)
    } catch (e) {
      console.warn("[v0] Failed to decode one stem", s.name, e)
    }
  }

  if (decodedBuffers.length === 0) {
    // If we failed to decode, just return the first available stem as instrumental
    const fallback = stems.find((s) => s !== vocals) || stems[0]
    return {
      vocalsBlob: vocals ? base64ToBlob(vocals.base64, vocals.mime) : new Blob([], { type: "audio/wav" }),
      instrumentalBlob: base64ToBlob(fallback.base64, fallback.mime),
      vocalsName: vocals?.name || "vocals.wav",
      instrumentalName: fallback.name || "instrumental.wav",
    }
  }

  const sampleRate = decodedBuffers[0].sampleRate
  const maxLen = Math.max(...decodedBuffers.map((b) => b.length))
  const mixCtx = new OfflineAudioContext(2, maxLen, sampleRate)

  decodedBuffers.forEach((buf) => {
    const src = new AudioBufferSourceNode(mixCtx, { buffer: buf })
    const gain = new GainNode(mixCtx, { gain: 1.0 / Math.sqrt(decodedBuffers.length) }) // prevent clipping
    src.connect(gain).connect(mixCtx.destination)
    src.start()
  })

  const mixed = await mixCtx.startRendering()
  const instrumentalWav = encodeWav(mixed)
  const instrumentalBlob = new Blob([instrumentalWav], { type: "audio/wav" })

  const vocalsBlob = vocals ? base64ToBlob(vocals.base64, vocals.mime) : new Blob([], { type: "audio/wav" })

  return {
    vocalsBlob,
    instrumentalBlob,
    vocalsName: vocals?.name || "vocals.wav",
    instrumentalName: "instrumental.wav",
  }
}

async function decodeAudio(arr: ArrayBuffer) {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  try {
    const audioBuffer = await ctx.decodeAudioData(arr.slice(0)) // copy
    ctx.close()
    return audioBuffer
  } catch (e) {
    ctx.close()
    throw e
  }
}

function encodeWav(buffer: AudioBuffer) {
  const numOfChan = buffer.numberOfChannels
  const length = buffer.length * numOfChan * 2 + 44
  const out = new ArrayBuffer(length)
  const view = new DataView(out)
  // RIFF chunk descriptor
  writeString(view, 0, "RIFF")
  view.setUint32(4, 36 + buffer.length * numOfChan * 2, true)
  writeString(view, 8, "WAVE")
  // FMT sub-chunk
  writeString(view, 12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numOfChan, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * numOfChan * 2, true)
  view.setUint16(32, numOfChan * 2, true)
  view.setUint16(34, 16, true)
  // data sub-chunk
  writeString(view, 36, "data")
  view.setUint32(40, buffer.length * numOfChan * 2, true)
  // write interleaved data
  const channels: Float32Array[] = []
  for (let i = 0; i < numOfChan; i++) channels.push(buffer.getChannelData(i))
  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numOfChan; ch++) {
      // clamp
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      // scale to 16-bit PCM
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return out
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}
