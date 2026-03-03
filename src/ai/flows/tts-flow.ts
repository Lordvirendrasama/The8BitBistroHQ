'use server';
/**
 * @fileOverview A text-to-speech (TTS) flow using Genkit.
 *
 * - generateSpeech - A function that converts text to speech audio.
 * - TtsInput - The input type for the generateSpeech function.
 * - TtsOutput - The return type for the generateSpeech function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import wav from 'wav';

const TtsInputSchema = z.object({
  text: z.string().describe('The text to convert to speech.'),
});
export type TtsInput = z.infer<typeof TtsInputSchema>;

const TtsOutputSchema = z.object({
    audioDataUri: z.string().optional().describe('The generated audio as a base64 data URI.'),
    error: z.string().optional().describe('Error message if generation failed.'),
});
export type TtsOutput = z.infer<typeof TtsOutputSchema>;

export async function generateSpeech(input: TtsInput): Promise<TtsOutput> {
    return ttsFlow(input);
}

const ttsFlow = ai.defineFlow(
  {
    name: 'ttsFlow',
    inputSchema: TtsInputSchema,
    outputSchema: TtsOutputSchema,
  },
  async (input) => {
    try {
        const { media } = await ai.generate({
            model: 'googleai/gemini-2.5-flash-preview-tts',
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Algenib' },
                },
              },
            },
            prompt: input.text,
          });
          
          if (!media || !media.url) {
            return { error: 'No media returned from TTS model' };
          }
          
          const audioBuffer = Buffer.from(
            media.url.substring(media.url.indexOf(',') + 1),
            'base64'
          );

          return {
            audioDataUri: 'data:audio/wav;base64,' + (await toWav(audioBuffer)),
          };
    } catch (error: any) {
        console.error("TTS Generation failed on server:", error);
        return { 
            error: error.message || 'Unknown error during TTS generation' 
        };
    }
  }
);

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    let bufs = [] as any[];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}
