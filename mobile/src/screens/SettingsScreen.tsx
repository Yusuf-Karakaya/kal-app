import React, { useEffect, useState } from 'react';
import { Alert, Share, Switch, Text, View } from 'react-native';
import { Data, Profile, Reminders, calcGoals, fmt, isTime, migrate, setWeight, todayKey } from '../data';
import { Btn, Card, Input, Segmented, styles as ui, useTheme } from '../ui';

interface Props {
  data: Data;
  permission: boolean;
  onSave: (next: Data, msg?: string) => void;
  onRequestPermission: () => void;
  onTest: () => void;
}

const ACTIVITY = [
  { value: 1.2, label: 'Hareketsiz' },
  { value: 1.375, label: 'Az' },
  { value: 1.55, label: 'Orta' },
  { value: 1.725, label: 'Çok' },
];
const GOALS = [
  { value: -500, label: 'Hızlı ver' },
  { value: -250, label: 'Yavaş ver' },
  { value: 0, label: 'Koru' },
  { value: 300, label: 'Kilo al' },
];
const INTERVALS = [
  { value: 30, label: '30 dk' },
  { value: 60, label: '1 sa' },
  { value: 90, label: '1,5 sa' },
  { value: 120, label: '2 sa' },
];

type NumKey = 'age' | 'height' | 'weight' | 'target' | 'kb' | 'cal' | 'water' | 'p' | 'c' | 'f';
const toNums = (d: Data): Record<NumKey, string> => ({
  age: String(d.profile.age), height: String(d.profile.height), weight: String(d.profile.weight),
  target: d.profile.targetWeight ? String(d.profile.targetWeight) : '', kb: String(d.kbWeight ?? 12),
  cal: String(d.goals.cal), water: String(d.goals.water), p: String(d.goals.p), c: String(d.goals.c), f: String(d.goals.f),
});

export default function SettingsScreen({ data, permission, onSave, onRequestPermission, onTest }: Props) {
  const c = useTheme();
  const [p, setP] = useState<Profile>(data.profile);
  const [num, setNum] = useState(toNums(data));
  const [r, setR] = useState<Reminders>(data.reminders);
  const [hint, setHint] = useState('');
  const [importText, setImportText] = useState('');

  useEffect(() => {
    setP(data.profile);
    setR(data.reminders);
    setNum(toNums(data));
  }, [data]);

  const n = (k: NumKey) => Number(num[k].replace(',', '.'));
  const profile = (): Profile => ({
    ...p,
    age: n('age') || p.age,
    height: n('height') || p.height,
    weight: n('weight') || p.weight,
    targetWeight: n('target') || undefined,
  });
  const macroKcal = n('p') * 4 + n('c') * 4 + n('f') * 9;

  const calc = () => {
    const res = calcGoals(profile());
    setNum((x) => ({ ...x, cal: String(res.cal), water: String(res.water), p: String(res.p), c: String(res.c), f: String(res.f) }));
    setHint(`Bazal metabolizma ${fmt(res.bmr)} kcal, günlük harcama ${fmt(res.tdee)} kcal. Kaydetmeyi unutma.`);
  };

  const saveProfile = () => {
    const cal = n('cal'), water = n('water');
    if (!(cal >= 800 && cal <= 6000) || !(water >= 500 && water <= 8000)) {
      Alert.alert('Geçersiz hedef', 'Kalori 800–6000 kcal, su 500–8000 ml arasında olmalı.');
      return;
    }
    const prof = profile();
    const kb = n('kb');
    let next: Data = { ...data, profile: prof, kbWeight: kb >= 2 && kb <= 64 ? kb : data.kbWeight, goals: { cal, water, p: n('p'), c: n('c'), f: n('f') } };
    if (prof.weight !== data.profile.weight) next = setWeight(next, todayKey(), prof.weight);
    onSave(next, 'Hedefler kaydedildi');
    setHint('');
  };

  const saveReminders = () => {
    const times = [r.start, r.end, r.breakfast, r.lunch, r.dinner, r.summary, r.weigh ?? '08:00'];
    if (!times.every(isTime)) {
      Alert.alert('Saat biçimi hatalı', 'Saatleri 09:30 gibi SS:DD biçiminde yaz.');
      return;
    }
    onSave({ ...data, reminders: r }, 'Hatırlatmalar yeniden planlandı');
    if (!permission) onRequestPermission();
  };

  const field = (label: string, key: NumKey) => (
    <View style={{ flex: 1 }}>
      <Text style={[ui.label, { color: c.muted }]}>{label}</Text>
      <Input value={num[key]} onChangeText={(t) => setNum((x) => ({ ...x, [key]: t }))} keyboardType="decimal-pad" />
    </View>
  );
  const time = (label: string, key: keyof Reminders) => (
    <View style={{ flex: 1 }}>
      <Text style={[ui.label, { color: c.muted }]}>{label}</Text>
      <Input
        value={String(r[key] ?? '')}
        onChangeText={(t) => setR((x) => ({ ...x, [key]: t }))}
        placeholder="SS:DD"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
      />
    </View>
  );
  const toggle = (label: string, key: 'waterOn' | 'mealOn' | 'summaryOn' | 'weighOn') => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: c.text, fontSize: 16 }}>{label}</Text>
      <Switch value={!!r[key]} onValueChange={(v) => setR((x) => ({ ...x, [key]: v }))} trackColor={{ true: c.leaf, false: c.line }} />
    </View>
  );

  return (
    <View style={{ gap: 14 }}>
      <Card title="Profil ve hedefler">
        <Segmented options={[{ value: 'f' as const, label: 'Kadın' }, { value: 'm' as const, label: 'Erkek' }]} value={p.sex} onChange={(v) => setP({ ...p, sex: v })} />
        <View style={ui.row}>{field('Yaş', 'age')}{field('Boy (cm)', 'height')}{field('Kilo (kg)', 'weight')}</View>
        <Text style={[ui.label, { color: c.muted }]}>Aktivite</Text>
        <Segmented options={ACTIVITY} value={p.activity} onChange={(v) => setP({ ...p, activity: v })} />
        <Text style={[ui.label, { color: c.muted }]}>Amaç</Text>
        <Segmented options={GOALS} value={p.goal} onChange={(v) => setP({ ...p, goal: v })} />
        <View style={ui.row}>{field('Hedef kilo (kg)', 'target')}{field('Kettlebell (kg)', 'kb')}</View>
        <Btn kind="ghost" label="Hedefleri hesapla" onPress={calc} />
        <View style={ui.row}>{field('Kalori (kcal)', 'cal')}{field('Su (ml)', 'water')}</View>
        <View style={ui.row}>{field('Protein (g)', 'p')}{field('Karb. (g)', 'c')}{field('Yağ (g)', 'f')}</View>
        <Text style={{ color: c.muted, fontSize: 12 }}>
          Makrolar {fmt(macroKcal)} kcal ediyor{Math.abs(macroKcal - n('cal')) > 50 ? ` (hedeften ${fmt(Math.abs(macroKcal - n('cal')))} ${macroKcal > n('cal') ? 'fazla' : 'eksik'})` : ''}.
        </Text>
        {hint ? <Text style={{ color: c.muted, fontSize: 13 }}>{hint}</Text> : null}
        <Btn label="Kaydet" onPress={saveProfile} />
      </Card>

      <Card title="Hatırlatmalar">
        <Text style={{ color: c.muted, fontSize: 13 }}>
          {permission ? 'Bildirimler açık. Uygulama kapalıyken de gelir.' : 'Hatırlatma alabilmek için bildirim izni ver.'}
        </Text>
        {!permission && <Btn label="Bildirimlere izin ver" onPress={onRequestPermission} />}
        {toggle('Su hatırlatıcısı', 'waterOn')}
        <Segmented options={INTERVALS} value={r.waterEvery} onChange={(v) => setR({ ...r, waterEvery: v })} />
        <View style={ui.row}>{time('Başlangıç', 'start')}{time('Bitiş', 'end')}</View>
        <Text style={{ color: c.muted, fontSize: 12 }}>Su içtikçe ertelenir, hedefe ulaşınca o gün için durur.</Text>
        {toggle('Öğün hatırlatıcısı', 'mealOn')}
        <View style={ui.row}>{time('Kahvaltı', 'breakfast')}{time('Öğle', 'lunch')}{time('Akşam', 'dinner')}</View>
        {toggle('Gün sonu özeti', 'summaryOn')}
        {toggle('Tartılma hatırlatıcısı', 'weighOn')}
        <View style={ui.row}>{time('Özet saati', 'summary')}{time('Tartılma saati', 'weigh')}</View>
        <Btn label="Kaydet" onPress={saveReminders} />
        <Btn kind="ghost" label="Test bildirimi gönder" onPress={onTest} />
      </Card>

      <Card title="Yedek">
        <Text style={{ color: c.muted, fontSize: 13 }}>
          Yedek, web sürümüyle aynı biçimdedir. Web sürümünde “Yedeği kopyala” ile aldığın metni buraya yapıştırarak verilerini taşıyabilirsin.
        </Text>
        <Btn kind="ghost" label="Yedeği paylaş" onPress={() => Share.share({ message: JSON.stringify(data) })} />
        <Input value={importText} onChangeText={setImportText} placeholder="Yedek metnini yapıştır" multiline style={{ minHeight: 70 }} />
        <Btn
          kind="ghost"
          label="Yedeği içe aktar"
          onPress={() => {
            try {
              const d = JSON.parse(importText);
              if (d && d.kalEnc === 1) {
                Alert.alert('Şifreli yedek', 'Bu yedek web sürümünde parola kilidiyle şifrelenmiş. Web sürümünde Ayarlar → Parola kilidi → "Kilidi kaldır" deyip yedeği yeniden kopyala, sonra buraya yapıştır.');
                return;
              }
              if (!d || !d.days) throw new Error();
              Alert.alert('Veriler değiştirilsin mi?', 'Mevcut veriler yedektekilerle değiştirilecek.', [
                { text: 'Vazgeç', style: 'cancel' },
                { text: 'Yükle', onPress: () => { onSave(migrate(d), 'Veriler yüklendi'); setImportText(''); } },
              ]);
            } catch {
              Alert.alert('Geçersiz yedek', 'Metnin tamamını kopyaladığından emin ol.');
            }
          }}
        />
        <Btn
          kind="danger"
          label="Tüm verileri sıfırla"
          onPress={() =>
            Alert.alert('Her şey silinsin mi?', 'Tüm kayıtlar ve ayarlar silinecek. Bu geri alınamaz.', [
              { text: 'Vazgeç', style: 'cancel' },
              { text: 'Hepsini sil', style: 'destructive', onPress: () => onSave(migrate({}), 'Sıfırlandı') },
            ])
          }
        />
      </Card>
    </View>
  );
}
