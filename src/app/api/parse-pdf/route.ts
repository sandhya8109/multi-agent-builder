import { NextResponse } from 'next/server';
// @ts-expect-error pdf-parse module lacks standard export definitions
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided.' },
        { status: 400 }
      );
    }

    const fileName = file.name || 'uploaded_file';
    const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let extractedText = '';

    // 1. PDF Files (.pdf)
    if (fileExt === 'pdf') {
      try {
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text.trim();
      } catch (pdfErr: any) {
        return NextResponse.json(
          { success: false, error: `Failed to parse PDF: ${pdfErr.message}` },
          { status: 400 }
        );
      }
    } 
    // 2. Word Documents (.docx / .doc)
    else if (fileExt === 'docx' || fileExt === 'doc') {
      try {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value.trim();
      } catch (docErr: any) {
        return NextResponse.json(
          { success: false, error: `Failed to parse Word document: ${docErr.message}` },
          { status: 400 }
        );
      }
    }
    // 3. Plain Text, CSV, JSON, Markdown, Code Files
    else {
      extractedText = buffer.toString('utf-8').trim();
    }

    return NextResponse.json({
      success: true,
      filename: fileName,
      fileType: fileExt.toUpperCase(),
      text: extractedText || `Extracted content from ${fileName}`,
    });
  } catch (err: any) {
    console.error('File parsing error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Error processing file.' },
      { status: 500 }
    );
  }
}