import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mimeType = file.type || '';
    const fileName = file.name || 'uploaded_file';

    let extractedText = '';

    // 1. RECEIPT / IMAGE HANDLING (PNG, JPG, WEBP) VIA OCR
    if (mimeType.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(fileName)) {
      // This previously called a paid vision model (first Groq's now-removed
      // 'llama-3.2-11b-vision-preview', then OpenAI's gpt-4o-mini once Groq
      // dropped vision support). Both require a paid API balance. Tesseract.js
      // runs OCR locally (WASM, no API key, no per-request cost) — lower
      // accuracy than a vision LLM on messy handwriting, but real text
      // extraction at zero ongoing cost, which is the actual requirement here.
      //
      // Requires the `tesseract.js` package — run `npm install tesseract.js`
      // if it's not already in package.json. Its first run downloads the
      // English language data file (a few MB) from a public CDN and caches
      // it locally, so that first OCR call will be slower and needs network
      // access; later calls are fully local.
      try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng');
        try {
          const {
            data: { text },
          } = await worker.recognize(buffer);
          extractedText = (text || '').trim();
        } finally {
          await worker.terminate();
        }

        if (!extractedText) {
          console.error(`[parse-pdf] Tesseract OCR found no text in "${fileName}" (${mimeType}).`);
        }
      } catch (ocrErr) {
        const message = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
        console.error(`[parse-pdf] OCR failed for "${fileName}":`, ocrErr);
        return NextResponse.json(
          { success: false, error: `Failed to perform OCR on image: ${message}` },
          { status: 400 }
        );
      }
    }
    // 2. PDF HANDLING
    else if (mimeType.includes('pdf') || fileName.endsWith('.pdf')) {
      try {
        // pdf-parse 2.x replaced the old v1 `pdf(buffer)` callable-function
        // API with a `PDFParse` class (`new PDFParse({ data }).getText()`).
        // The previous code here still called it the v1 way, which throws
        // immediately on every PDF, silently falling into the regex
        // fallback below (which only works on uncompressed PDF text
        // streams and produces garbage or nothing on real-world PDFs).
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        try {
          const result = await parser.getText();
          extractedText = result.text || '';
        } finally {
          await parser.destroy();
        }
      } catch (pdfErr) {
        console.error('[parse-pdf] pdf-parse failed, falling back to raw stream regex extraction:', pdfErr);
        // Last-resort fallback for PDFs pdf-parse itself can't handle
        // (e.g. malformed files): regex extraction targeting uncompressed
        // PDF text stream blocks (BT ... ET). This will not work on the
        // (common) case of compressed content streams.
        const raw = buffer.toString('latin1');
        const textBlocks: string[] = [];
        const btRegex = /BT[\s\S]*?ET/g;
        let match;

        while ((match = btRegex.exec(raw)) !== null) {
          const strMatches = match[0].match(/\(([^()]*)\)/g);
          if (strMatches) {
            const cleaned = strMatches
              .map((s) => s.slice(1, -1))
              .join(' ')
              .replace(/\\/g, '');
            if (cleaned.trim().length > 1) {
              textBlocks.push(cleaned);
            }
          }
        }
        extractedText = textBlocks.join('\n');
      }
    }
    // 3. PLAIN TEXT / CSV / TXT / JSON HANDLING
    else {
      extractedText = buffer.toString('utf-8');
    }

    // Clean whitespace and formatting
    extractedText = extractedText
      .replace(/\r\n/g, '\n')
      .replace(/[^\S\r\n]+/g, ' ')
      .trim();

    if (!extractedText) {
      return NextResponse.json(
        { success: false, error: 'Could not extract readable text from this file.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      text: extractedText,
      filename: fileName,
    });
  } catch (err: any) {
    console.error('Error in /api/parse-pdf:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Server error while parsing file.' },
      { status: 500 }
    );
  }
}