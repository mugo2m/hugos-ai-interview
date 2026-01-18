import { NextRequest, NextResponse } from 'next/server';
import { SpeechToTextService } from '@/lib/voice/speechToText';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    const stt = new SpeechToTextService(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);
    const transcript = await stt.transcribeAudioFile(audioFile);

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}