/**
 * AlchemicalRitual.tsx — Алхімічний прогрес-бар для MAGICUM
 * React Native / Expo (Reanimated v3 + SVG)
 */
import React, { useEffect, useState, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle,
  useAnimatedReaction, withTiming, withRepeat, withSequence,
  runOnJS, interpolate, Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop, RadialGradient } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

// ─── ГЕОМЕТРІЯ ───────────────────────────────────────────────────────────────
const { width: W } = Dimensions.get('window');
const CIRCLE_SIZE   = Math.min(W * 0.84, 340);
const STROKE        = 7;
const RADIUS        = CIRCLE_SIZE / 2 - STROKE - 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const INNER_SIZE    = Math.round(RADIUS * 1.92);
const INNER_OFFSET  = (CIRCLE_SIZE - INNER_SIZE) / 2;
const CX = CIRCLE_SIZE / 2;
const CY = CIRCLE_SIZE / 2;

// Руни навколо кола (рівномірно)
const RUNES    = ['ᚱ','ᚢ','ᚾ','ᛁ','ᚲ','ᚠ','ᛗ','ᛟ'];
const RUNE_R   = RADIUS + 20;
const RUNE_POS = RUNES.map((char, i) => {
  const a = (i / RUNES.length) * Math.PI * 2 - Math.PI / 2;
  return { char, x: CX + Math.cos(a) * RUNE_R, y: CY + Math.sin(a) * RUNE_R };
});

// Іскри: 8 напрямків
const SPARK_ANGLES = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);

// Мілстоуни для спалахів (30 / 60 / 90 %)
const MILESTONES = [0.30, 0.60, 0.90];

// Фази ритуалу
const PHASES = [
  { t: 0.00, icon: '⚗️', text: 'Ініціалізація простору…',       haptic: 'none'   },
  { t: 0.15, icon: '🔍', text: 'Сканування геометрії меблів…',  haptic: 'light'  },
  { t: 0.40, icon: '🧵', text: 'Аналіз ниток [Шеніл / Велюр]…', haptic: 'light'  },
  { t: 0.60, icon: '✨', text: 'Плетіння просторової магми…',    haptic: 'medium' },
  { t: 0.85, icon: '🪄', text: 'Закріплення магічної печатки…', haptic: 'medium' },
  { t: 1.00, icon: '🔥', text: 'Ритуал завершено!',              haptic: 'heavy'  },
] as const;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── 1. РУНІЧНЕ КОЛО ─────────────────────────────────────────────────────────
const RunicRing = ({
  progress, runeRotation, flashOpacity,
}: {
  progress: Animated.SharedValue<number>;
  runeRotation: Animated.SharedValue<number>;
  flashOpacity: Animated.SharedValue<number>;
}) => {
  // Анімований дашофсет — заповнення дуги
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  // Пульсація зовнішнього ореолу
  const glowProps = useAnimatedProps(() => ({
    opacity: 0.15 + progress.value * 0.25,
    r: RADIUS + 4 + progress.value * 6,
  }));

  // Повільне обертання рун
  const runeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${runeRotation.value}deg` }],
  }));

  // Спалах завершення
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  return (
    <View style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}>
      <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
        <Defs>
          {/* Градієнт дуги */}
          <LinearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor="#9b59b6" />
            <Stop offset="45%"  stopColor="#e67e22" />
            <Stop offset="100%" stopColor="#f1c40f" />
          </LinearGradient>
          {/* Ореол */}
          <RadialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="60%" stopColor="#9b59b6" stopOpacity="0" />
            <Stop offset="100%" stopColor="#9b59b6" stopOpacity="0.6" />
          </RadialGradient>
        </Defs>

        {/* Пульсуючий ореол (зовнішній) */}
        <AnimatedCircle cx={CX} cy={CY} stroke="#9b59b6" strokeWidth={1}
          fill="url(#glowGrad)" animatedProps={glowProps} />

        {/* Базова темна доріжка */}
        <Circle cx={CX} cy={CY} r={RADIUS}
          stroke="#2A1B3D" strokeWidth={STROKE + 2} fill="none" />

        {/* Анімована дуга прогресу */}
        <AnimatedCircle
          cx={CX} cy={CY} r={RADIUS}
          stroke="url(#arcGrad)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          fill="none"
          // SVG починає з правого боку — повертаємо старт на верх
          rotation={-90} origin={`${CX}, ${CY}`}
          animatedProps={arcProps}
        />
      </Svg>

      {/* Руни (окремий шар, що обертається) */}
      <Animated.View
        style={[StyleSheet.absoluteFill, runeStyle]}
        pointerEvents="none"
      >
        {RUNE_POS.map(({ char, x, y }, i) => (
          <Text
            key={i}
            style={[styles.rune, { position: 'absolute', left: x - 8, top: y - 10 }]}
          >
            {char}
          </Text>
        ))}
      </Animated.View>

      {/* Спалах при завершенні */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.flash, flashStyle]}
        pointerEvents="none"
      />
    </View>
  );
};

// ─── 2. ІСКРА МІЛСТОУНУ ─────────────────────────────────────────────────────
const SparkleParticle = memo(({
  angle, burst,
}: {
  angle: number;
  burst: number;
}) => {
  const tx      = useSharedValue(0);
  const ty      = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale   = useSharedValue(0);

  useEffect(() => {
    if (burst === 0) return;
    const dist = 28 + Math.random() * 20;
    tx.value = 0; ty.value = 0; opacity.value = 0; scale.value = 0;

    opacity.value = withSequence(
      withTiming(1,   { duration: 120 }),
      withTiming(0.8, { duration: 280 }),
      withTiming(0,   { duration: 200 }),
    );
    scale.value = withSequence(
      withTiming(1.4, { duration: 120 }),
      withTiming(0.6, { duration: 480 }),
    );
    tx.value = withTiming(Math.cos(angle) * dist, { duration: 600, easing: Easing.out(Easing.quad) });
    ty.value = withTiming(Math.sin(angle) * dist, { duration: 600, easing: Easing.out(Easing.quad) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burst]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.spark, style]} />;
});

const SparkleField = memo(({ burst }: { burst: number }) => (
  <View style={styles.sparkField} pointerEvents="none">
    {SPARK_ANGLES.map((a, i) => (
      <SparkleParticle key={i} angle={a} burst={burst} />
    ))}
  </View>
));

// ─── 3. МАГІЧНИЙ ПОТІК ТКАНИНИ ───────────────────────────────────────────────
const FabricFlask = ({
  progress, fabricColor, burst,
}: {
  progress: Animated.SharedValue<number>;
  fabricColor: string;
  burst: number;
}) => {
  const [h, setH] = useState(0);

  // Висота заповнення знизу вгору
  const fillStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, h]),
  }));

  // Пульсуючий верхній край (хвиля)
  const waveOpacity = useSharedValue(0.4);
  useEffect(() => {
    waveOpacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false
    );
  }, []);
  const waveStyle = useAnimatedStyle(() => ({ opacity: waveOpacity.value }));

  // Шимер (діагональний відблиск)
  const shimmerX = useSharedValue(-INNER_SIZE);
  useEffect(() => {
    shimmerX.value = withRepeat(
      withTiming(INNER_SIZE * 2, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
  }, []);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={e => setH(e.nativeEvent.layout.height)}
      pointerEvents="none"
    >
      {/* Заповнення знизу */}
      <Animated.View style={[styles.fill, { backgroundColor: fabricColor }, fillStyle]}>

        {/* Нитки-лінії (текстура тканини) */}
        {Array.from({ length: 14 }, (_, i) => (
          <View key={i} style={[styles.thread, { top: `${i * 7}%` as unknown as number }]} />
        ))}

        {/* Шимер-відблиск */}
        <Animated.View style={[styles.shimmer, shimmerStyle]} />

        {/* Пульсуючий верхній край */}
        <Animated.View style={[styles.waveLine, waveStyle]} />
      </Animated.View>

      {/* Скляний відблиск зверху (постійний) */}
      <View style={styles.glassHighlight} pointerEvents="none" />

      {/* Іскри мілстоунів */}
      <SparkleField burst={burst} />
    </View>
  );
};

// ─── 4. МАГІЧНИЙ ПИЛ (постійні частинки) ────────────────────────────────────
const DustParticle = memo(({ index }: { index: number }) => {
  const ty      = useSharedValue(0);
  const opacity = useSharedValue(0);
  const dur     = 2000 + index * 300;
  const left    = `${8 + (index / 6) * 80}%`;

  useEffect(() => {
    ty.value = withRepeat(
      withTiming(-110, { duration: dur, easing: Easing.out(Easing.quad) }),
      -1, false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 400 }),
        withTiming(0.6, { duration: dur - 700 }),
        withTiming(0,   { duration: 300 }),
      ),
      -1, false
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
    opacity: opacity.value,
    left: left as unknown as number,
  }));

  return <Animated.View style={[styles.dust, style]} />;
});

const MagicDust = ({ progress }: { progress: Animated.SharedValue<number> }) => {
  const [active, setActive] = useState(false);
  useAnimatedReaction(
    () => progress.value > 0.12 && progress.value < 0.97,
    (cur, prev) => { if (cur !== prev) runOnJS(setActive)(cur); }
  );
  if (!active) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: 6 }, (_, i) => <DustParticle key={i} index={i} />)}
    </View>
  );
};

// ─── 5. АЛХІМІЧНИЙ ЛОГ ──────────────────────────────────────────────────────
const AlchemicalLog = ({ progress }: { progress: Animated.SharedValue<number> }) => {
  const [log, setLog] = useState([PHASES[0]]);
  const lastIdx  = useSharedValue(0);
  const curOpacity = useSharedValue(1);

  const haptic = useCallback((type: string) => {
    if (type === 'heavy')  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    else if (type === 'light')  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const addEntry = useCallback((idx: number) => {
    // Нова фаза: поточна тьмяніє, нова спалахує
    curOpacity.value = withSequence(
      withTiming(0.3, { duration: 150 }),
      withTiming(1,   { duration: 200 }),
    );
    setLog(prev => [...prev.slice(-1), PHASES[idx]]);
  }, [curOpacity]);

  useAnimatedReaction(
    () => {
      'worklet';
      let idx = 0;
      for (let i = PHASES.length - 1; i >= 0; i--) {
        if (progress.value >= PHASES[i].t) { idx = i; break; }
      }
      return idx;
    },
    (cur, prev) => {
      if (cur !== prev && cur !== lastIdx.value) {
        lastIdx.value = cur;
        runOnJS(addEntry)(cur);
        runOnJS(haptic)(PHASES[cur].haptic as string);
      }
    }
  );

  const curStyle = useAnimatedStyle(() => ({ opacity: curOpacity.value }));

  return (
    <View style={styles.logWrap}>
      {/* Попередня фаза (тьмяна) */}
      {log.length > 1 && (
        <Text style={styles.logPrev} numberOfLines={1}>
          {log[0].icon}{'  '}{log[0].text}
        </Text>
      )}
      {/* Поточна фаза (яскрава) */}
      <Animated.View style={curStyle}>
        <Text style={styles.logCurrent} numberOfLines={1}>
          {log[log.length - 1].icon}{'  '}{log[log.length - 1].text}
        </Text>
      </Animated.View>
    </View>
  );
};

// ─── ГОЛОВНИЙ КОМПОНЕНТ ──────────────────────────────────────────────────────
export interface AlchemicalRitualProps {
  /** URI або base64 фото меблів */
  sofaImage?: string | null;
  /** Hex-колір тканини для заповнення (default: фіолетовий) */
  fabricColor?: string;
  /** Тривалість у мс (default: 24000 — під ліміт Netlify 26с) */
  duration?: number;
  /** Виклик після завершення анімації */
  onComplete: () => void;
}

export const AlchemicalRitual: React.FC<AlchemicalRitualProps> = ({
  sofaImage,
  fabricColor = '#7b2fbe',
  duration    = 24000,
  onComplete,
}) => {
  const progress      = useSharedValue(0);
  const runeRotation  = useSharedValue(0);
  const flashOpacity  = useSharedValue(0);
  const [burst, setBurst] = useState(0);

  // Основна анімація прогресу
  useEffect(() => {
    progress.value = withTiming(1, { duration, easing: Easing.linear }, finished => {
      if (finished) {
        // Спалах завершення
        flashOpacity.value = withSequence(
          withTiming(1,   { duration: 200 }),
          withTiming(0.6, { duration: 100 }),
          withTiming(1,   { duration: 150 }),
          withTiming(0,   { duration: 500 }),
        );
        runOnJS(onComplete)();
      }
    });

    // Нескінченне обертання рун (1 оберт за 18 секунд)
    runeRotation.value = withRepeat(
      withTiming(360, { duration: 18000, easing: Easing.linear }),
      -1,
      false
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Спалахи на мілстоунах 30 / 60 / 90 %
  const triggeredMilestones = useSharedValue<number[]>([]);
  const triggerBurst = useCallback(() => setBurst(b => b + 1), []);
  const hapticMedium = useCallback(() =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), []);

  useAnimatedReaction(
    () => progress.value,
    (cur) => {
      for (const ms of MILESTONES) {
        if (cur >= ms && !triggeredMilestones.value.includes(ms)) {
          triggeredMilestones.value = [...triggeredMilestones.value, ms];
          runOnJS(triggerBurst)();
          runOnJS(hapticMedium)();
        }
      }
    }
  );

  return (
    <View style={styles.root}>
      {/* Фоновий ambient */}
      <View style={styles.ambient} />

      {/* Рунічне коло + вміст */}
      <View style={styles.stage}>

        {/* SVG-кільце + руни + спалах */}
        <RunicRing
          progress={progress}
          runeRotation={runeRotation}
          flashOpacity={flashOpacity}
        />

        {/* Внутрішнє кругле вікно */}
        <View style={styles.inner}>
          {/* Фото меблів */}
          {sofaImage ? (
            <Image
              source={{ uri: sofaImage }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.innerPlaceholder]} />
          )}

          {/* Магічний потік тканини */}
          <FabricFlask
            progress={progress}
            fabricColor={fabricColor}
            burst={burst}
          />

          {/* Магічний пил */}
          <MagicDust progress={progress} />
        </View>
      </View>

      {/* Алхімічний лог */}
      <AlchemicalLog progress={progress} />
    </View>
  );
};

// ─── СТИЛІ ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080412',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(123, 47, 190, 0.07)',
  },

  // Центральна сцена: SVG + inner
  stage: {
    width:  CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Внутрішнє кругле вікно (позиційоване точно в центрі кола)
  inner: {
    position:        'absolute',
    top:             INNER_OFFSET,
    left:            INNER_OFFSET,
    width:           INNER_SIZE,
    height:          INNER_SIZE,
    borderRadius:    INNER_SIZE / 2,
    overflow:        'hidden',
    backgroundColor: '#150d24',
  },
  innerPlaceholder: {
    backgroundColor: '#1e1038',
  },

  // Заповнення тканиною (позиція bottom, висота анімована)
  fill: {
    position: 'absolute',
    bottom:   0,
    left:     0,
    right:    0,
    overflow: 'hidden',
  },

  // Нитки тканини
  thread: {
    position:        'absolute',
    left:            0,
    right:           0,
    height:          1,
    backgroundColor: 'rgba(255, 215, 80, 0.18)',
    transform:       [{ rotate: '30deg' }],
  },

  // Шимер
  shimmer: {
    position: 'absolute',
    top:      0,
    width:    40,
    height:   '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    transform: [{ skewX: '-20deg' }],
  },

  // Хвиля верхнього краю заповнення
  waveLine: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          3,
    backgroundColor: 'rgba(255, 215, 80, 0.7)',
    shadowColor:     '#f1c40f',
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   1,
    shadowRadius:    6,
  },

  // Скляний відблиск зверху
  glassHighlight: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          '30%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius:    INNER_SIZE / 2,
  },

  // Контейнер іскор — по центру внутрішнього кола
  sparkField: {
    position:       'absolute',
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // Одна іскра
  spark: {
    position:        'absolute',
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: '#f1c40f',
    shadowColor:     '#f1c40f',
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   1,
    shadowRadius:    5,
    elevation:       5,
  },

  // Частинки магічного пилу
  dust: {
    position:        'absolute',
    bottom:          12,
    width:           4,
    height:          4,
    borderRadius:    2,
    backgroundColor: '#d4a8ff',
    shadowColor:     '#9b59b6',
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.8,
    shadowRadius:    4,
    elevation:       3,
  },

  // Руна
  rune: {
    color:        'rgba(201, 168, 76, 0.55)',
    fontSize:     13,
    fontWeight:   '300',
    textAlign:    'center',
  },

  // Спалах завершення (повноекранний)
  flash: {
    backgroundColor: '#f1c40f',
    borderRadius:    CIRCLE_SIZE / 2,
  },

  // Лог
  logWrap: {
    position:        'absolute',
    bottom:          52,
    left:            20,
    right:           20,
    backgroundColor: 'rgba(8, 4, 18, 0.9)',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius:    50,
    borderWidth:     1,
    borderColor:     'rgba(155, 89, 182, 0.45)',
    alignItems:      'center',
    gap:             4,
  },
  logPrev: {
    color:         'rgba(180, 150, 220, 0.35)',
    fontSize:      11,
    letterSpacing: 0.3,
    textAlign:     'center',
  },
  logCurrent: {
    color:         '#f1c40f',
    fontSize:      15,
    fontWeight:    '600',
    letterSpacing: 0.4,
    textAlign:     'center',
    textShadowColor:  'rgba(241, 196, 15, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
