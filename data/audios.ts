import type { AudioItem } from '@/components/player/audio/types';

export const AUDIOS: AudioItem[] = [
  {
    id: 'soundhelix-1',
    title: 'SoundHelix Song 1',
    artist: 'T. Schürger',
    album: 'SoundHelix',
    type: 'mp3',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    duration: 372,
    artwork: 'https://picsum.photos/seed/sh1/600/600',
  },
  {
    id: 'soundhelix-2',
    title: 'SoundHelix Song 2',
    artist: 'T. Schürger',
    album: 'SoundHelix',
    type: 'mp3',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    duration: 425,
    artwork: 'https://picsum.photos/seed/sh2/600/600',
  },
  {
    id: 'samplelib-15s',
    title: 'Sample 15s',
    artist: 'samplelib.com',
    album: 'Test samples',
    type: 'mp3',
    uri: 'https://download.samplelib.com/mp3/sample-15s.mp3',
    duration: 15,
    artwork: 'https://picsum.photos/seed/sl15/600/600',
  },
  {
    id: 'somafm-groovesalad',
    title: 'SomaFM Groove Salad',
    artist: 'SomaFM',
    album: 'Live Internet Radio',
    type: 'stream',
    isLive: true,
    uri: 'https://ice1.somafm.com/groovesalad-128-mp3',
    artwork: 'https://picsum.photos/seed/somafm/600/600',
  },
];
