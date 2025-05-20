// app/screens/Onboarding.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';

type Step = 0 | 1 | 2 | 3 | 4;
const TOTAL_STEPS = 5;

const Onboarding = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);

  // form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState('');
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [videoConnected, setVideoConnected] = useState(false);
  const [creativityTime, setCreativityTime] = useState<{ start: string; end: string } | null>(null);

  // Sign-up step
  const onSignUp = async () => {
    if (!email || !password || password !== confirm) {
      return alert('Please check your email and passwords match');
    }
    setLoading(true);
    try {
      await axios.post('/api/signup', { email, password });
      setStep(1);
    } catch {
      alert('Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  // Next / Prev for steps 1–4
  const onNext = async () => {
    if (step === 1) {
      if (!role.trim()) return alert('Please enter what you do');
      await axios.post('/api/users/me/preferences', { role: role.trim() });
    }
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => (s + 1) as Step);
    } else {
      navigation.replace('Home');
    }
  };
  const onPrev = () => {
    if (step > 0) setStep((s) => (s - 1) as Step);
  };

  // Optional connectors
  const connectCalendar = async () => {
    setCalendarConnected(true);
    await axios.post('/api/users/me/preferences', { calendarConnected: true });
    onNext();
  };
  const connectVideo = async () => {
    setVideoConnected(true);
    await axios.post('/api/users/me/preferences', { videoConnected: true });
    onNext();
  };
  const saveCreativity = async () => {
    if (!creativityTime) return alert('Enter your creative hours');
    await axios.post('/api/users/me/preferences', { creativityTime });
    onNext();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.stepIndicator}>Step {step + 1} / {TOTAL_STEPS}</Text>

        {/* Step 0: Sign Up */}
        {step === 0 && (
          <View style={styles.step}>
            <Text style={styles.label}>Sign up</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#888"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              placeholderTextColor="#888"
              value={password}
              onChangeText={setPassword}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              secureTextEntry
              placeholderTextColor="#888"
              value={confirm}
              onChangeText={setConfirm}
            />

            <TouchableOpacity style={styles.fullButton} onPress={onSignUp} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#121212" />
                : <Text style={styles.fullButtonText}>Sign Up</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.replace('Login')}>
              <Text style={styles.loginLink}>Already have an account? Login</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 1: Role (mandatory) */}
        {step === 1 && (
          <View style={styles.step}>
            <Text style={styles.label}>What do you do?</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Graphic Designer"
              placeholderTextColor="#888"
              value={role}
              onChangeText={setRole}
            />
          </View>
        )}

        {/* Step 2: Calendar (optional) */}
        {step === 2 && (
          <View style={styles.step}>
            <Text style={styles.label}>Connect your calendar (optional)</Text>
            <TouchableOpacity style={styles.button} onPress={connectCalendar}>
              <Text style={styles.buttonText}>
                {calendarConnected ? 'Connected' : 'Connect Calendar'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipLink} onPress={onNext}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3: Video Apps (optional) */}
        {step === 3 && (
          <View style={styles.step}>
            <Text style={styles.label}>Connect video apps (optional)</Text>
            <TouchableOpacity style={styles.button} onPress={connectVideo}>
              <Text style={styles.buttonText}>
                {videoConnected ? 'Connected' : 'Connect Zoom/Meet'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipLink} onPress={onNext}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 4: Creativity Hours (optional) */}
        {step === 4 && (
          <View style={styles.step}>
            <Text style={styles.label}>When are you most creative? (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 9:00 AM - 12:00 PM"
              placeholderTextColor="#888"
              onChangeText={(t) => {
                const [s, e] = t.split('-');
                setCreativityTime({ start: s?.trim(), end: e?.trim() } as any);
              }}
            />
            <TouchableOpacity style={styles.button} onPress={saveCreativity}>
              <Text style={styles.buttonText}>Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipLink} onPress={onNext}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Prev/Next nav for steps ≥1 */}
        {step > 0 && (
          <View style={styles.navRow}>
            <TouchableOpacity disabled={step === 0} onPress={onPrev}>
              <Text style={[styles.navText, step === 0 && styles.disabled]}>Prev</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextButton} onPress={onNext}>
              <Text style={styles.nextText}>
                {step < TOTAL_STEPS - 1 ? 'Next' : 'Finish'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#121212' },
  container: { flex: 1, paddingHorizontal: 16, justifyContent: 'center' },
  stepIndicator: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  step: { marginBottom: 32 },
  label: { color: '#fff', fontSize: 18, marginBottom: 12 },
  input: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
  },
  fullButton: {
    backgroundColor: '#00E0B0',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  fullButtonText: {
    color: '#121212',
    fontWeight: '600',
    fontSize: 16,
    width: '100%',
    textAlign: 'center',
  },
  loginLink: { color: '#00E0B0', textAlign: 'center', marginTop: 8 },
  button: {
    backgroundColor: '#00E0B0',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: { color: '#121212', fontWeight: '600', fontSize: 16 },
  skipLink: { alignItems: 'center', marginTop: 4 },
  skipText: { color: '#00E0B0', fontSize: 14 },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  navText: { color: '#00E0B0', fontSize: 16 },
  disabled: { opacity: 0.4 },
  nextButton: {
    backgroundColor: '#00E0B0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  nextText: { color: '#121212', fontSize: 16, fontWeight: '600' },
});
// git change..

export default Onboarding;
