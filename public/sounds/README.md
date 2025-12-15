# Sound Files

This directory contains audio files for the call feature.

## Required Files

- `ringtone.mp3` - Played when receiving an incoming call
- `calling.mp3` - Played when making an outgoing call

## Fallback

If these files are not present, the app will use Web Audio API to generate simple tones as a fallback.

## Recommended Specifications

- Format: MP3 or OGG
- Duration: 2-5 seconds (will loop)
- Sample Rate: 44100 Hz
- Bitrate: 128 kbps
- Volume: Normalized to -3dB
