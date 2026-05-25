import React, { useEffect, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

// ── Константи ────────────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');
const CIRCLE_SIZE  = SCREEN_W * 0.75;
const RADIUS       = CIRCLE_SIZE / 2 - 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const INNER_SIZE   = CIRCLE_SIZE - 32;
const INNER_OFFSET = (CIRCLE_SIZE - INNER_SIZE) / 2; // центрування всередині кола
const PARTICLE_COUNT = 8;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Фази ─────────────────────────────────────────────────────────────────────
const PHASES = [
  { threshold: 0.00, icon: '⚗️', text: 'Ініціалізація простору...',         haptic: false },
  { threshold: 0.15, icon: '🔍', text: 'Сканування геометрії меблів...',    haptic: true  },
  { threshold: 0.40, icon: '🧵', text: 'Аналіз ниток [Шеніл / Велюр]...',   haptic: true  },
  { threshold: 0.60, icon: '✨', text: 'Плетіння просторової магми...',      haptic: true  },
  { threshold: 0.85, icon: '🪄', text: 'Закріплення магічної печатки...',    haptic: true  },
  { threshold: 1.00, icon: '🔥', text: 'Ритуал завершено!',                  haptic: true  },
] as const;

// ── 1. Рунічне коло (SVG) ────────────────────────────────────────────────────
const RunicCircle = ({ progress }: { progress: Animated.SharedValue<number> }) => {
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
      <Defs>
        <LinearGradient id="runicGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%"   stopColor="#9b59b6" />
          <Stop offset="50%"  stopColor="#e67e22" />
          <Stop offset="100%" stopColor="#f1c40f" />
        </LinearGradient>
      </Defs>

      {/* Базове коло */}
      <Circle
        cx={CIRCLE_SIZE / 2} cy={CIRCLE_SIZE / 2} r={RADIUS}
        stroke="#2A1B3D" strokeWidth={6} fill="none"
      />
      {/* Анімований прогрес */}
      <AnimatedCircle
        cx={CIRCLE_SIZE / 2} cy={CIRCLE_SIZE / 2} r={RADIUS}
        stroke="url(#runicGrad)"
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        fill="none"
        animatedProps={animatedProps}
      />
    </Svg>
  );
};

// ── 2. Магічний потік тканини (знизу вгору) ───────────────────────────────────
// transformOrigin не підтримується в RN → анімуємо height через onLayout
const FabricFlow = ({ progress }: { progress: Animated.SharedValue<number> }) => {
  const [containerH, setContainerH] = useState(0);

  const fillStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, containerH]),
  }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={e => setContainerH(e.nativeEvent.layout.height)}
      pointerEvents="none"
    >
      <Animated.View style={[styles.fabricFill, fillStyle]}>
        {/* Імітація ниток: прості лінії під кутом */}
        {Array.from({ length: 10 }, (_, i) => (
          <View
            key={i}
            style={[styles.threadLine, { top: `${i * 10}%` as unknown as number }]}
          />
        ))}
      </Animated.View>
    </View>
  );
};

// ── 3. Частинки (Magical Dust) ────────────────────────────────────────────────
const Particle = memo(({ index }: { index: number }) => {
  const ty      = useSharedValue(0);
  const opacity = useSharedValue(0);
  const dur     = 1800 + index * 220;
  const leftPct = `${5 + (index / PARTICLE_COUNT) * 85}%`;

  useEffect(() => {
    ty.value = withRepeat(
      withTiming(-130, { duration: dur, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 350 }),
        withTiming(0.7, { duration: dur - 650 }),
        withTiming(0,   { duration: 300 }),
      ),
      -1,
      false
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
    opacity:   opacity.value,
    left:      leftPct as unknown as number,
  }));

  return <Animated.View style={[styles.particle, style]} />;
});

const ParticleSystem = ({ progress }: { progress: Animated.SharedValue<number> }) => {
  const [active, setActive] = useState(false);

  // useAnimatedReaction замість progress.addListener (Reanimated v3)
  useAnimatedReaction(
    () => progress.value > 0.2 && progress.value < 0.95,
    (current, prev) => {
      if (current !== prev) runOnJS(setActive)(current);
    }
  );

  if (!active) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
        <Particle key={i} index={i} />
      ))}
    </View>
  );
};

// ── 4. Алхімічний лог ────────────────────────────────────────────────────────
const AlchemicalLog = ({ progress }: { progress: Animated.SharedValue<number> }) => {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const lastPhase = useSharedValue(0);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  useAnimatedReaction(
    () => {
      'worklet';
      let idx = 0;
      for (let i = PHASES.length - 1; i >= 0; i--) {
        if (progress.value >= PHASES[i].threshold) { idx = i; break; }
      }
      return idx;
    },
    (current, prev) => {
      if (current !== prev && current !== lastPhase.value) {
        lastPhase.value = current;
        runOnJS(setPhaseIdx)(current);
        if (PHASES[current].haptic) runOnJS(triggerHaptic)();
      }
    }
  );

  const phase = PHASES[phaseIdx];

  return (
    <View style={styles.logContainer}>
      <Text style={styles.logText}>
        {phase.icon}{'  '}{phase.text}
      </Text>
    </View>
  );
};

// ── ГОЛОВНИЙ КОМПОНЕНТ ────────────────────────────────────────────────────────
interface AlchemicalRitualProps {
  sofaImage?: string | null;
  duration?: number;
  onComplete: () => void;
}

export const AlchemicalRitual: React.FC<AlchemicalRitualProps> = ({
  sofaImage,
  duration = 35000,
  onComplete,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(onComplete)();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      {/* Фоновий ambient */}
      <View style={styles.glow} />

      {/* Рунічне коло + внутрішній вміст у єдиному контейнері */}
      <View style={styles.ritualContainer}>

        {/* SVG-кільце прогресу */}
        <RunicCircle progress={progress} />

        {/* Внутрішнє коло: фото + потік тканини + частинки */}
        <View style={styles.inner}>
          {sofaImage ? (
            <Image
              source={{ uri: sofaImage }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : null}
          <FabricFlow   progress={progress} />
          <ParticleSystem progress={progress} />
        </View>
      </View>

      {/* Текстовий лог фази */}
      <AlchemicalLog progress={progress} />
    </View>
  );
};

// ── СТИЛІ ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0514',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(155, 89, 182, 0.06)',
  },

  // Обгортка кола — явний розмір, щоб inner міг абсолютно центруватись
  ritualContainer: {
    width:  CIRCLE_SIZE,
    height: CIRCLE_SIZE,
  },

  // Внутрішнє кругле вікно (photo + fabric + particles)
  // top/left — явне центрування замість '15%' + 20
  inner: {
    position:     'absolute',
    top:          INNER_OFFSET,
    left:         INNER_OFFSET,
    width:        INNER_SIZE,
    height:       INNER_SIZE,
    borderRadius: INNER_SIZE / 2,
    overflow:     'hidden',
    backgroundColor: '#1e1029',
  },

  // Потік тканини — позиція absolute bottom, висота анімована
  fabricFill: {
    position: 'absolute',
    bottom:   0,
    left:     0,
    right:    0,
    backgroundColor: 'rgba(155, 89, 182, 0.75)',
    overflow: 'hidden',
  },

  // Декоративні лінії всередині потоку (імітація ниток)
  // backgroundImage не підтримується в RN → використовуємо View
  threadLine: {
    position:        'absolute',
    left:            0,
    right:           0,
    height:          1,
    backgroundColor: 'rgba(241, 196, 15, 0.20)',
    transform:       [{ rotate: '45deg' }],
  },

  // Частинки
  particle: {
    position:      'absolute',
    bottom:        8,
    width:         5,
    height:        5,
    borderRadius:  2.5,
    backgroundColor: '#f1c40f',
    shadowColor:   '#f1c40f',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius:  5,
    elevation:     4,
  },

  // Лог внизу екрану
  // backdropFilter не підтримується в RN → використовуємо напівпрозорий фон
  logContainer: {
    position:        'absolute',
    bottom:          60,
    left:            24,
    right:           24,
    alignItems:      'center',
    backgroundColor: 'rgba(10, 5, 20, 0.88)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius:    40,
    borderWidth:     1,
    borderColor:     'rgba(155, 89, 182, 0.55)',
  },
  logText: {
    color:       '#f1c40f',
    fontSize:    15,
    fontWeight:  '600',
    letterSpacing: 0.4,
    textAlign:   'center',
    textShadowColor:  'rgba(155, 89, 182, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
