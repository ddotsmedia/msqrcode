import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getJson, SITE } from '../src/api';
import { C } from '../src/theme';

interface BranchStats {
  branch_id: string;
  branch_name: string;
  scans: number;
  page_views: number;
  last_menu_update: string | null;
  paused: boolean;
  zero_scans_7d: boolean;
  daily_scans: number[];
}

interface AnalyticsResponse {
  total: number;
  active: number;
  paused: number;
  scans_today: number;
  branches: BranchStats[];
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) return <View style={s.sparkEmpty} />;
  const max = Math.max(...data, 1);
  const BAR_W = 18;
  const BAR_H = 48;
  const GAP = 4;

  return (
    <View style={[s.sparkRow, { height: BAR_H }]}>
      {data.map((val, i) => {
        const h = Math.max(3, Math.round((val / max) * BAR_H));
        const isLast = i === data.length - 1;
        return (
          <View key={i} style={{ width: BAR_W, height: BAR_H, justifyContent: 'flex-end', marginRight: i < data.length - 1 ? GAP : 0 }}>
            <View
              style={{
                width: BAR_W,
                height: h,
                borderRadius: 4,
                backgroundColor: isLast ? C.navy2 : C.gold,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileValue}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
      {!!sub && <Text style={s.tileSub}>{sub}</Text>}
    </View>
  );
}

export default function BranchAnalyticsScreen() {
  const { branchId, branchName } = useLocalSearchParams<{ branchId: string; branchName: string }>();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['branch-analytics', branchId],
    queryFn: () => getJson<AnalyticsResponse>('/analytics/branches'),
    staleTime: 60_000,
  });

  const stats = data?.branches.find((b) => b.branch_id === branchId);

  const days = ['7d ago', '6d', '5d', '4d', '3d', '2d', 'Today'];

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      {/* Header */}
      <Pressable onPress={() => router.back()} style={s.backBtn}>
        <Text style={s.backText}>← Back</Text>
      </Pressable>

      <Text style={s.hero}>📊 Analytics</Text>
      <Text style={s.subtitle}>{branchName ?? 'Branch'}</Text>

      {isLoading && (
        <View style={s.loadingBox}>
          <Text style={s.loadingText}>Loading analytics…</Text>
        </View>
      )}

      {isError && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>Could not load analytics.</Text>
          <Pressable onPress={() => refetch()} style={s.retryBtn}>
            <Text style={s.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {stats && (
        <>
          {/* Stat tiles */}
          <View style={s.tileRow}>
            <StatTile label="Total scans" value={stats.scans} />
            <StatTile label="Menu views" value={stats.page_views} />
          </View>

          {/* Status badge */}
          {stats.paused && (
            <View style={s.warningBadge}>
              <Text style={s.warningText}>⏸ Menu is paused</Text>
            </View>
          )}
          {stats.zero_scans_7d && (
            <View style={s.warningBadge}>
              <Text style={s.warningText}>⚠️ No scans in the last 7 days</Text>
            </View>
          )}

          {/* Sparkline */}
          <View style={s.chartCard}>
            <Text style={s.chartTitle}>Daily scans — last 7 days</Text>
            <Sparkline data={stats.daily_scans} />
            {stats.daily_scans.length > 0 && (
              <View style={s.dayLabels}>
                {days.map((d) => (
                  <Text key={d} style={s.dayLabel}>{d}</Text>
                ))}
              </View>
            )}
          </View>

          {/* Last menu update */}
          {stats.last_menu_update && (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Last menu update</Text>
              <Text style={s.infoValue}>
                {new Date(stats.last_menu_update).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </Text>
            </View>
          )}

          {/* View menu link */}
          <Pressable
            style={s.menuBtn}
            onPress={() => router.push({ pathname: '/(tabs)/index' })}>
            <Text style={s.menuBtnText}>☕ Go to Menu</Text>
          </Pressable>
        </>
      )}

      {!isLoading && !isError && !stats && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>No analytics data for this branch yet.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.cream },
  content: { padding: 20, paddingBottom: 48 },

  backBtn: { marginTop: 52, marginBottom: 4 },
  backText: { color: C.navy2, fontSize: 15, fontWeight: '600' },

  hero: { fontSize: 28, fontWeight: '700', color: C.navy, marginTop: 12 },
  subtitle: { fontSize: 16, color: C.muted, marginTop: 4, marginBottom: 20 },

  loadingBox: { padding: 32, alignItems: 'center' },
  loadingText: { color: C.muted, fontSize: 15 },

  errorBox: { backgroundColor: C.white, borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  errorText: { color: C.muted, fontSize: 15, marginBottom: 12 },
  retryBtn: { backgroundColor: C.navy2, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 24 },
  retryText: { color: C.white, fontWeight: '600', fontSize: 14 },

  tileRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  tile: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
  },
  tileValue: { fontSize: 32, fontWeight: '700', color: C.navy },
  tileLabel: { fontSize: 12, color: C.muted, marginTop: 4, textAlign: 'center' },
  tileSub: { fontSize: 11, color: C.muted, marginTop: 2 },

  warningBadge: {
    backgroundColor: '#fef9c3',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fde047',
  },
  warningText: { color: '#854d0e', fontSize: 13, fontWeight: '600' },

  chartCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  chartTitle: { fontSize: 14, fontWeight: '600', color: C.navy, marginBottom: 14 },
  sparkRow: { flexDirection: 'row', alignItems: 'flex-end' },
  sparkEmpty: { height: 48, backgroundColor: C.cream, borderRadius: 8 },
  dayLabels: { flexDirection: 'row', marginTop: 8, justifyContent: 'space-between' },
  dayLabel: { fontSize: 9, color: C.muted, flex: 1, textAlign: 'center' },

  infoRow: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 12,
  },
  infoLabel: { fontSize: 13, color: C.muted },
  infoValue: { fontSize: 13, fontWeight: '600', color: C.navy },

  menuBtn: {
    backgroundColor: C.navy2,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  menuBtnText: { color: C.white, fontWeight: '700', fontSize: 16 },
});
