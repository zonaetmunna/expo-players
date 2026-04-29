import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { PlatformSupport, VideoItem } from '@/components/player/expo-video/types';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-5 px-4">
      <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </Text>
      <View className="rounded-xl bg-card px-3">{children}</View>
    </View>
  );
}

export function Spec({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View className="flex-row items-center gap-3 border-b border-border py-2 last:border-b-0">
      <Text className="w-32 text-sm text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-sm font-medium text-foreground">{value}</Text>
    </View>
  );
}

export function PlatformRow({ label, p }: { label: string; p: PlatformSupport }) {
  return (
    <View className="flex-row items-start gap-3 border-b border-border py-2 last:border-b-0">
      <Text className="w-20 text-sm font-semibold text-foreground">{label}</Text>
      <Text className="text-base">{p.supported ? '✅' : '❌'}</Text>
      <View className="flex-1">
        {p.minVersion ? (
          <Text className="text-xs text-muted-foreground">Min version: {p.minVersion}</Text>
        ) : null}
        {p.browsers && p.browsers.length > 0 ? (
          <Text className="text-xs text-muted-foreground">
            Browsers: {p.browsers.join(', ')}
          </Text>
        ) : null}
        {p.note ? <Text className="text-xs text-muted-foreground">{p.note}</Text> : null}
      </View>
    </View>
  );
}

function Badge({ bg, label }: { bg: string; label: string }) {
  return (
    <View className={`rounded ${bg} px-2 py-1`}>
      <Text className="text-[11px] font-bold tracking-wide text-white">{label}</Text>
    </View>
  );
}

function UrlRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="border-b border-border py-2 last:border-b-0">
      <Text className="mb-1 text-sm text-muted-foreground">{label}</Text>
      <Text className="font-mono text-[11px] text-foreground/80" numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, i) => (
        <View key={i} className="border-b border-border py-2 last:border-b-0">
          <Text className="text-sm text-foreground/90">• {item}</Text>
        </View>
      ))}
    </>
  );
}

export function VideoHeaderInfo({ video }: { video: VideoItem }) {
  return (
    <View className="gap-2 px-4 pt-4">
      <Text className="text-xl font-bold text-foreground">{video.title}</Text>

      <View className="flex-row flex-wrap gap-2">
        <Badge bg="bg-neutral-900" label={video.type.toUpperCase()} />
        <Badge bg="bg-neutral-700" label={video.category} />
        {video.codecVideo ? (
          <Badge bg="bg-blue-600" label={video.codecVideo.toUpperCase()} />
        ) : null}
        {video.resolution ? (
          <Badge bg="bg-emerald-600" label={video.resolution.toUpperCase()} />
        ) : null}
        {video.hdr ? <Badge bg="bg-amber-500" label={video.hdr.toUpperCase()} /> : null}
        {video.drm ? <Badge bg="bg-violet-600" label={`DRM · ${video.drm.type}`} /> : null}
        {video.isLive ? <Badge bg="bg-red-600" label="LIVE" /> : null}
      </View>

      {video.description ? (
        <Text className="mt-1 text-sm leading-5 text-foreground/80">{video.description}</Text>
      ) : null}
    </View>
  );
}

export function TechnicalSpecs({ video }: { video: VideoItem }) {
  const duration = video.isLive
    ? 'Live'
    : video.duration
      ? `${Math.floor(video.duration / 60)}m ${video.duration % 60}s`
      : undefined;

  return (
    <Section title="🔧 Technical specs">
      <Spec label="Container" value={video.type.toUpperCase()} />
      <Spec label="Video codec" value={video.codecVideo?.toUpperCase()} />
      <Spec label="Audio codec" value={video.codecAudio?.toUpperCase()} />
      <Spec label="Resolution" value={video.resolution?.toUpperCase()} />
      <Spec label="HDR" value={video.hdr?.toUpperCase()} />
      <Spec label="Duration" value={duration} />
      <Spec
        label="DRM"
        value={video.drm ? `${video.drm.type} (${video.drm.licenseServer})` : undefined}
      />
    </Section>
  );
}

export function DeviceCompatibility({ video }: { video: VideoItem }) {
  return (
    <Section title="📱 Device compatibility">
      <PlatformRow label="iOS" p={video.platforms.ios} />
      <PlatformRow label="Android" p={video.platforms.android} />
      <PlatformRow label="Web" p={video.platforms.web} />
    </Section>
  );
}

export function KnownIssues({ video }: { video: VideoItem }) {
  const hasIssues = video.knownIssues && video.knownIssues.length > 0;
  const hasRestrictions = video.restrictions && video.restrictions.length > 0;

  return (
    <>
      {hasIssues ? (
        <Section title="⚠️ Known issues">
          <BulletList items={video.knownIssues!} />
        </Section>
      ) : null}
      {hasRestrictions ? (
        <Section title="🔒 Restrictions">
          <BulletList items={video.restrictions!} />
        </Section>
      ) : null}
    </>
  );
}

export function SourceInfo({ video }: { video: VideoItem }) {
  return (
    <Section title="🔗 Source">
      <Spec label="Origin" value={video.source} />
      <Spec label="License" value={video.license} />
      <UrlRow label="URL" value={video.uri} />
      {video.drm ? <UrlRow label="License server" value={video.drm.licenseServer} /> : null}
    </Section>
  );
}
