import { useQuery } from '@tanstack/react-query';
import { Image, Text, View } from 'react-native';
import { SITE } from '../../src/api';
import { Page, ui } from '../../src/ui';

type Item = { src: string; alt: string; caption?: string };

export default function GalleryScreen() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['gallery'],
    queryFn: async (): Promise<Item[]> => {
      const r = await fetch(`${SITE}/gallery/gallery.json`);
      if (!r.ok) throw new Error('gallery');
      const j = await r.json();
      return Array.isArray(j) ? j : [];
    },
  });
  const url = (src: string) => (src.startsWith('http') ? src : `${SITE}${src.startsWith('/') ? '' : '/'}${src}`);
  return (
    <Page kicker="Inside Milestones" title="Gallery">
      {isLoading && <Text style={ui.lead}>Loading…</Text>}
      {isError && <Text style={ui.error}>Could not load the gallery. Please try again.</Text>}
      {data && data.length === 0 && <Text style={ui.lead}>Photos coming soon.</Text>}
      {(data ?? []).map((it) => (
        <View key={it.src} style={{ marginBottom: 14 }}>
          <Image source={{ uri: url(it.src) }} accessibilityLabel={it.alt} style={{ width: '100%', height: 220, borderRadius: 18 }} resizeMode="cover" />
          {!!it.caption && <Text style={ui.sub}>{it.caption}</Text>}
        </View>
      ))}
    </Page>
  );
}
