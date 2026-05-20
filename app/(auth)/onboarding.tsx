import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palette } from '../../lib/theme/colors';

const { height: H } = Dimensions.get('window');
const HERO_H = H * 0.53;
export const ONBOARDING_KEY = 'onboarding_complete';

const SLIDES = [
  { isIntro: true, title: '', description: '' },
  {
    isIntro: false,
    title: 'Compete with\nyour crew.',
    description:
      'Create rivalries, track your victories and keep the heat on your challenger.',
  },
  {
    isIntro: false,
    title: 'Bet on your\ngame.',
    description:
      'Track every play. Own your stats. Have receipts for your bragging rights.',
  },
  {
    isIntro: false,
    title: 'Share your\nmoment.',
    description:
      'Celebrate your wins by sharing with your friends and let the leaderboard do the talking.',
  },
];

// ─── Blob SVG shapes ──────────────────────────────────────────────────────────

function BlobGreenLarge() {
  return (
    <Svg width={280} height={255} viewBox="0 0 280 255">
      <Path
        d="M215 8 C245 -4 278 18 276 62 C274 106 248 145 210 167 C172 189 128 190 97 170 C66 150 50 115 58 84 C66 53 52 22 80 10 C108 -2 185 20 215 8 Z"
        fill="#4D7500"
        fillOpacity={0.72}
      />
    </Svg>
  );
}

function BlobGreenMedium() {
  return (
    <Svg width={195} height={215} viewBox="0 0 195 215">
      <Path
        d="M95 8 C135 -2 175 22 182 68 C189 114 165 162 122 178 C79 194 30 178 12 140 C-6 102 8 52 38 28 C58 12 55 18 95 8 Z"
        fill="#3A5C00"
        fillOpacity={0.6}
      />
    </Svg>
  );
}

function BlobBlue() {
  return (
    <Svg width={120} height={115} viewBox="0 0 120 115">
      <Path
        d="M60 4 C88 -2 115 18 116 50 C117 82 92 110 60 110 C28 110 3 84 4 52 C5 20 32 10 60 4 Z"
        fill="#6BC6E5"
        fillOpacity={0.63}
      />
    </Svg>
  );
}

// ─── Animated blob wrapper ────────────────────────────────────────────────────

function AnimatedBlob({
  style,
  children,
  enterDelay,
  floatDuration,
  floatAmount,
}: {
  style?: object;
  children: React.ReactNode;
  enterDelay: number;
  floatDuration: number;
  floatAmount: number;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      delay: enterDelay,
      tension: 38,
      friction: 7,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: floatDuration,
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: floatDuration,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: enter,
          transform: [
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) },
            {
              translateY: float.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -floatAmount],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const contentFade = useRef(new Animated.Value(1)).current;

  const finish = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(auth)/login');
  }, [router]);

  const next = useCallback(() => {
    if (step >= SLIDES.length - 1) {
      finish();
      return;
    }
    Animated.sequence([
      Animated.timing(contentFade, { toValue: 0, duration: 130, useNativeDriver: true }),
      Animated.timing(contentFade, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start(() => setStep(s => s + 1));
  }, [step, contentFade, finish]);

  const slide = SLIDES[step];

  return (
    <View style={styles.root}>
      {/* ── Hero: lime bg + animated blobs ── */}
      <View style={styles.hero}>
        <AnimatedBlob
          style={styles.blobLarge}
          enterDelay={0}
          floatDuration={3200}
          floatAmount={12}
        >
          <BlobGreenLarge />
        </AnimatedBlob>

        <AnimatedBlob
          style={styles.blobMedium}
          enterDelay={180}
          floatDuration={3700}
          floatAmount={8}
        >
          <BlobGreenMedium />
        </AnimatedBlob>

        <AnimatedBlob
          style={styles.blobBlue}
          enterDelay={340}
          floatDuration={2900}
          floatAmount={6}
        >
          <BlobBlue />
        </AnimatedBlob>
      </View>

      {/* ── Content ── */}
      <Animated.View style={[styles.content, { opacity: contentFade }]}>
        {slide.isIntro ? (
          <TouchableOpacity
            style={styles.introInner}
            onPress={next}
            activeOpacity={0.92}
          >
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.introTextBlock}>
              <Text style={styles.introCTA}>Compete</Text>
              <Text style={styles.introCTA}>Bet</Text>
              <Text style={styles.introCTA}>Share</Text>
            </View>
            <View style={styles.introLine} />
          </TouchableOpacity>
        ) : (
          <View style={styles.slideInner}>
            {/* Dots + Skip */}
            <View style={styles.dotsRow}>
              <View style={styles.dots}>
                {[1, 2, 3].map(i => (
                  <View
                    key={i}
                    style={[styles.dot, step === i && styles.dotActive]}
                  />
                ))}
              </View>
              <TouchableOpacity onPress={finish} hitSlop={12}>
                <Text style={styles.skip}>Skip</Text>
              </TouchableOpacity>
            </View>

            {/* Text */}
            <View style={styles.textBlock}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.description}>{slide.description}</Text>
            </View>

            {/* CTA */}
            <TouchableOpacity style={styles.cta} onPress={next} activeOpacity={0.85}>
              <Text style={styles.ctaText}>
                {step === SLIDES.length - 1 ? "Let's Play  →" : 'Next  →'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bunkerSand,
  },

  // Hero
  hero: {
    height: HERO_H,
    backgroundColor: palette.highVisLime,
    overflow: 'hidden',
  },
  blobLarge: {
    position: 'absolute',
    top: -35,
    right: -75,
  },
  blobMedium: {
    position: 'absolute',
    top: 25,
    left: -25,
  },
  blobBlue: {
    position: 'absolute',
    bottom: 15,
    left: -12,
  },

  // Content
  content: {
    flex: 1,
  },

  // Intro slide
  introInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  logo: {
    width: 160,
    height: 68,
    marginBottom: 28,
  },
  introTextBlock: {
    alignItems: 'center',
    gap: 2,
    marginBottom: 32,
  },
  introCTA: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.graphiteShaft,
    lineHeight: 36,
  },
  introLine: {
    width: 56,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.highVisLime,
  },

  // Onboarding slides
  slideInner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 22,
    paddingBottom: 44,
    justifyContent: 'space-between',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 26,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D8D8CE',
  },
  dotActive: {
    width: 38,
    backgroundColor: palette.highVisLime,
  },
  skip: {
    fontSize: 15,
    fontWeight: '500',
    color: palette.graphiteShaft,
  },
  textBlock: {
    flex: 1,
    paddingTop: 32,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: palette.graphiteShaft,
    lineHeight: 40,
    marginBottom: 14,
  },
  description: {
    fontSize: 15,
    color: '#4A4A40',
    lineHeight: 23,
  },
  cta: {
    backgroundColor: palette.graphiteShaft,
    borderRadius: 100,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: palette.bunkerSand,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
