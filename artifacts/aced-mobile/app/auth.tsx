import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  useLogin,
  useRegister,
  useRequestMagicLink,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';

type AuthMode = 'login' | 'register' | 'magic';

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setUser } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setUser({
          id: data.data.id,
          email: data.data.email,
          role: data.data.role,
          emailVerified: data.data.emailVerified,
        });
        router.back();
      },
      onError: (err: any) => {
        Alert.alert('Sign in failed', err.message ?? 'Invalid email or password');
      },
    },
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setUser({
          id: data.data.id,
          email: data.data.email,
          role: data.data.role,
          emailVerified: data.data.emailVerified,
        });
        router.back();
      },
      onError: (err: any) => {
        Alert.alert('Registration failed', err.message ?? 'Could not create account');
      },
    },
  });

  const magicMutation = useRequestMagicLink({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMagicSent(true);
      },
      onError: (err: any) => {
        Alert.alert('Error', err.message ?? 'Could not send magic link');
      },
    },
  });

  const isLoading =
    loginMutation.isPending || registerMutation.isPending || magicMutation.isPending;

  const handleSubmit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (mode === 'login') {
      if (!email || !password) {
        Alert.alert('Missing fields', 'Please enter your email and password.');
        return;
      }
      loginMutation.mutate({ data: { email, password } });
    } else if (mode === 'register') {
      if (!email || !password || !displayName) {
        Alert.alert('Missing fields', 'Please fill in all fields.');
        return;
      }
      registerMutation.mutate({ data: { email, password, displayName } });
    } else {
      if (!email) {
        Alert.alert('Enter email', 'Please enter your email address.');
        return;
      }
      magicMutation.mutate({ data: { email } });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[colors.navy, colors.gradientStart]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 12 }]}
      >
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
        <View style={[styles.logoMark, { borderColor: 'rgba(255,255,255,0.3)' }]}>
          <Ionicons name="diamond-outline" size={22} color="#fff" />
        </View>
        <Text style={styles.headerTitle}>aced</Text>
        <Text style={styles.headerSub}>
          {mode === 'magic' ? 'Sign in without a password' : 'Your tutor marketplace'}
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.body}>
          {/* Mode toggle */}
          <View style={[styles.modeToggle, { backgroundColor: colors.muted }]}>
            {(['login', 'register', 'magic'] as AuthMode[]).map((m) => {
              const labels = { login: 'Sign in', register: 'Register', magic: 'Magic link' };
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeTab, mode === m && { backgroundColor: colors.card }]}
                  onPress={() => { setMode(m); setMagicSent(false); }}
                >
                  <Text style={[styles.modeTabText, { color: mode === m ? colors.foreground : colors.mutedForeground }]}>
                    {labels[m]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Magic link sent state */}
          {mode === 'magic' && magicSent ? (
            <View style={[styles.successState, { backgroundColor: colors.muted }]}>
              <Ionicons name="mail-outline" size={40} color={colors.primary} />
              <Text style={[styles.successTitle, { color: colors.foreground }]}>Check your inbox</Text>
              <Text style={[styles.successText, { color: colors.mutedForeground }]}>
                We sent a magic link to{'\n'}{email}
              </Text>
              <TouchableOpacity
                onPress={() => { setMagicSent(false); setEmail(''); }}
                style={styles.retryLink}
              >
                <Text style={[styles.retryText, { color: colors.primary }]}>Use a different email</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              {/* Display name (register only) */}
              {mode === 'register' && (
                <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="person-outline" size={18} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder="Full name"
                    placeholderTextColor={colors.mutedForeground}
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                    autoComplete="name"
                    returnKeyType="next"
                  />
                </View>
              )}

              {/* Email */}
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Email address"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  returnKeyType={mode === 'magic' ? 'done' : 'next'}
                  onSubmitEditing={mode === 'magic' ? handleSubmit : undefined}
                />
              </View>

              {/* Password (login + register only) */}
              {mode !== 'magic' && (
                <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder={mode === 'register' ? 'Password (min 8 chars)' : 'Password'}
                    placeholderTextColor={colors.mutedForeground}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </TouchableOpacity>
                </View>
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, { opacity: isLoading ? 0.7 : 1 }]}
                onPress={handleSubmit}
                disabled={isLoading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[colors.gradientStart, colors.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitText}>
                      {mode === 'login'
                        ? 'Sign in'
                        : mode === 'register'
                        ? 'Create account'
                        : 'Send magic link'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Switch modes hint */}
              <TouchableOpacity
                style={styles.switchHint}
                onPress={() => setMode(mode === 'login' ? 'magic' : 'login')}
              >
                <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
                  {mode === 'login'
                    ? 'Prefer a magic link? '
                    : mode === 'magic'
                    ? 'Have a password? '
                    : 'Already have an account? '}
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>
                    {mode === 'login' ? 'Send one' : 'Sign in'}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 0,
    padding: 10,
    marginTop: 8,
  },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },

  body: { flex: 1, padding: 20, gap: 20 },

  modeToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
  },

  form: { gap: 14 },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  input: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },

  submitBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  switchHint: { alignItems: 'center', paddingVertical: 4 },
  switchText: { fontSize: 14 },

  successState: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 16,
    gap: 10,
  },
  successTitle: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  successText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  retryLink: { marginTop: 8 },
  retryText: { fontSize: 14, fontWeight: '600' },
});
