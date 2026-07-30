import { NextResponse } from 'next/server';

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const pdfLib = require('pdf-parse/lib/pdf-parse.js');
    if (typeof pdfLib === 'function') {
      const res = await pdfLib(buffer);
      if (res?.text) return res.text;
    }
  } catch {}

  const pdfModule = require('pdf-parse');
  const fn = typeof pdfModule === 'function' ? pdfModule : pdfModule.default;
  if (fn) {
    const res = await fn(buffer);
    if (res?.text) return res.text;
  }
  throw new Error('Could not parse PDF file.');
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let text = '';
    if (file.name.toLowerCase().endsWith('.pdf')) {
      text = await parsePdfBuffer(buffer);
    } else {
      text = buffer.toString('utf-8');
    }

    return NextResponse.json({ text });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}