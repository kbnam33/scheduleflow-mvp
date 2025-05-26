// app/screens/onboarding.tsx

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
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Assuming logger is a utility you might have or want for more detailed client-side logging
// If not, you can remove these calls or replace them with console.log
const logger = {
  info: (message: string, ...args: any[]) => console.log(`INFO: ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`ERROR: ${message}`, ...args),
};

type OnboardingNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

// IMPORTANT: Ensure this matches your backend's port and your computer's local IP
// if testing on an Android emulator or a physical device.
// Example for Android Emulator/Device: const API_BASE_URL = 'http://192.168.1.X:3001/api';
// Example for iOS Simulator: const API_BASE_URL = 'http://localhost:3001/api';
const API_BASE_URL = 'http://192.168.1.5:3001/api'; // Using the IP you confirmed

type Step = 0 | 1 | 2 | 3 | 4;
const TOTAL_STEPS = 5; // Sign up (0) + Role (1) + Calendar (2) + Video (3) + Creative Hours (4)

const OnboardingScreen = ({ navigation }: { navigation: OnboardingNavigationProp }) => {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(0);
  const [loading, setLoading] = useState(false);

  // Form state for Step 0 (Sign Up)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fullName, setFullName] = useState('');

  // Form state for Step 1 (Role)
  const [userRole, setUserRole] = useState('');

  // Form state for Step 2 (Calendar) - string to hold provider name or 'skipped'
  const [calendarProvider, setCalendarProvider] = useState<string | null>(null);

  // Form state for Step 3 (Video) - string to hold provider name or 'skipped'
  const [videoProvider, setVideoProvider] = useState<string | null>(null);
  
  // Form state for Step 4 (Creative Hours)
  const [creativeHours, setCreativeHours] = useState<string>('');

  const storeUserData = async (token: string, userId: string, userEmail: string) => {
    try {
      await AsyncStorage.setItem('@user_token', token);
      await AsyncStorage.setItem('@user_id', userId);
      await AsyncStorage.setItem('@user_email', userEmail);
      logger.info('User data stored in AsyncStorage.');
    } catch (e) {
      logger.error('Failed to save user data to AsyncStorage', e);
      Alert.alert('Error', 'Failed to save your session. Please try logging in.');
      navigation.replace('Login'); // Or handle more gracefully
    }
  };

  const onSignUp = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Full name is required.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Email and password are required.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Validation Error', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      // The 'role' can be passed during signup if desired, or collected in the next step.
      // For this flow, let's assume role is collected in the next step.
      const response = await axios.post(`${API_BASE_URL}/auth/signup`, {
        email: email.trim().toLowerCase(),
        password: password.trim(),
        fullName: fullName.trim(),
        // role: userRole.trim() // Optionally send role if collected at signup
      });

      if (response.data && response.data.token && response.data.userId) {
        await storeUserData(response.data.token, response.data.userId, response.data.email);
        logger.info('Signup successful, token stored.', { userId: response.data.userId });
        setStep(1); // Move to the "What do you do?" step
      } else {
        throw new Error('Signup failed: Invalid response from server.');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Sign up failed. Please try again.';
      logger.error('Signup API error', { details: errorMessage, errorObj: error });
      Alert.alert('Sign Up Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const savePreferenceAndProceed = async (preferenceKey: string, preferenceValue: any) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('@user_token');
      if (!token) {
        Alert.alert('Authentication Error', 'You are not logged in. Please sign up or log in.');
        setStep(0); // Go back to signup
        navigation.replace('Onboarding'); // Or Login
        return;
      }

      // Construct payload based on the preference key
      const payload: { [key: string]: any } = {};
      payload[preferenceKey] = preferenceValue;
      
      // Using POST to /api/users/me/preferences which UserPreferences.updatePreferences handles as an upsert
      await axios.post(`${API_BASE_URL}/users/me/preferences`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      logger.info(`Preference '${preferenceKey}' saved.`);

      if (step < TOTAL_STEPS - 1) {
        setStep((s) => (s + 1) as Step);
      } else {
        logger.info('Onboarding completed.');
        navigation.replace('Home');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save preference.';
      logger.error('Save preference error', { details: errorMessage, errorObj: error });
      Alert.alert('Error Saving Preference', errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const handleNextStep = () => {
    switch (step) {
      case 1: // After "What do you do?"
        if (!userRole.trim()) {
          Alert.alert('Required', 'Please tell us what you do.');
          return;
        }
        savePreferenceAndProceed('role', userRole.trim());
        break;
      case 2: // After Calendar Connection attempt/skip
        savePreferenceAndProceed('calendarProvider', calendarProvider || 'skipped');
        break;
      case 3: // After Video App Connection attempt/skip
        savePreferenceAndProceed('videoProvider', videoProvider || 'skipped');
        break;
      case 4: // After Creative Hours
        if (!creativeHours.trim()) {
          Alert.alert('Input Needed', 'Please enter your creative hours, or skip.');
          return;
        }
        // Ensure the key matches what the backend expects for user_preferences table/logic
        savePreferenceAndProceed('creative_hours_pref', creativeHours.trim()); 
        break;
      default: // Should not happen if step logic is correct
        if (step < TOTAL_STEPS - 1) {
          setStep((s) => (s + 1) as Step);
        } else {
          logger.info('Onboarding completed.');
          navigation.replace('Home');
        }
        break;
    }
  };

  const handleSkipCurrentStep = () => {
    // For optional steps, save a "skipped" status or default
    switch (step) {
      case 2: // Calendar
        savePreferenceAndProceed('calendarProvider', 'skipped');
        break;
      case 3: // Video
        savePreferenceAndProceed('videoProvider', 'skipped');
        break;
      case 4: // Creative Hours
        savePreferenceAndProceed('creative_hours_pref', 'skipped');
        break;
      default: // For non-optional steps or if skip doesn't apply in this manner
        if (step < TOTAL_STEPS - 1) {
          setStep((s) => (s + 1) as Step);
        } else {
          navigation.replace('Home');
        }
        break;
    }
  };

  const renderCurrentStep = () => {
    switch (step) {
      case 0: // Sign Up
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Create Your Account</Text>
            <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#888" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
            <TextInput style={styles.input} placeholder="Email Address" placeholderTextColor="#888" keyboardType="email-address" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Password (min. 6 characters)" secureTextEntry placeholderTextColor="#888" value={password} onChangeText={setPassword} />
            <TextInput style={styles.input} placeholder="Confirm Password" secureTextEntry placeholderTextColor="#888" value={confirm} onChangeText={setConfirm} />
            <TouchableOpacity style={styles.primaryButton} onPress={onSignUp} disabled={loading}>
              {loading ? <ActivityIndicator color="#121212" /> : <Text style={styles.primaryButtonText}>Sign Up & Continue</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.replace('Login')}>
              <Text style={styles.linkText}>Already have an account? Login</Text>
            </TouchableOpacity>
          </View>
        );
      case 1: // Role
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>What's Your Role?</Text>
            <Text style={styles.subtitle}>This helps us tailor your experience (e.g., Graphic Designer, Writer).</Text>
            <TextInput style={styles.input} placeholder="Enter your profession" placeholderTextColor="#888" value={userRole} onChangeText={setUserRole} autoCapitalize="words" />
          </View>
        );
      case 2: // Calendar Integration
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Connect Your Calendar</Text>
            <Text style={styles.subtitle}>Allow ScheduleFlow to manage your events. (Optional)</Text>
            <TouchableOpacity style={styles.optionButton} onPress={() => { setCalendarProvider('google'); handleNextStep(); }}>
              <MaterialCommunityIcons name="google" size={20} color="#00E0B0" style={styles.optionIcon} />
              <Text style={styles.optionButtonText}>Connect Google Calendar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionButton} onPress={() => { setCalendarProvider('outlook'); handleNextStep(); }}>
              <MaterialCommunityIcons name="microsoft-outlook" size={20} color="#00E0B0" style={styles.optionIcon} />
              <Text style={styles.optionButtonText}>Connect Outlook Calendar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton} onPress={handleSkipCurrentStep}>
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        );
      case 3: // Video App Integration
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Link Video Conferencing</Text>
            <Text style={styles.subtitle}>Connect your preferred video call apps. (Optional)</Text>
            <TouchableOpacity style={styles.optionButton} onPress={() => { setVideoProvider('zoom'); handleNextStep(); }}>
              <MaterialCommunityIcons name="video-outline" size={20} color="#00E0B0" style={styles.optionIcon} />
              <Text style={styles.optionButtonText}>Connect Zoom</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionButton} onPress={() => { setVideoProvider('google_meet'); handleNextStep(); }}>
              <MaterialCommunityIcons name="google-hangouts" size={20} color="#00E0B0" style={styles.optionIcon} />
              <Text style={styles.optionButtonText}>Connect Google Meet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton} onPress={handleSkipCurrentStep}>
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        );
      case 4: // Creative Hours
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Your Creative Time</Text>
            <Text style={styles.subtitle}>When do you usually do your best creative work? (e.g., "Mornings 9 AM - 1 PM")</Text>
            <TextInput style={styles.input} placeholder="e.g., Weekday afternoons" placeholderTextColor="#888" value={creativeHours} onChangeText={setCreativeHours} />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? (insets.top + insets.bottom + 40) : 0}
      >
        <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]} />
        </View>
        <Text style={styles.stepIndicator}>Step {step + 1} of {TOTAL_STEPS}</Text>
        
        <View style={styles.contentArea}>
            {renderCurrentStep()}
        </View>

        {/* Navigation Footer for steps after signup */}
        {step > 0 && (
          <View style={styles.navigationFooter}>
            <TouchableOpacity 
                style={[styles.secondaryButton, step === 1 && styles.disabledButton]} // Disable "Previous" on the first step after signup
                onPress={() => { if (step > 1) setStep(s => (s - 1) as Step); else if (step === 1) setStep(0);}} // Go to signup from role screen
                disabled={loading || step === 1} // Example logic for disabling, adjust if step 1 shouldn't go to 0
            >
              <Text style={styles.secondaryButtonText}>Previous</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButtonNav} onPress={handleNextStep} disabled={loading}>
              {loading ? <ActivityIndicator color="#121212" /> : <Text style={styles.primaryButtonText}>{step === TOTAL_STEPS - 1 ? 'Finish Setup' : 'Next'}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
    
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#121212' },
  keyboardAvoidingContainer: { flex: 1, justifyContent: 'space-between' },
  progressBarContainer: { height: 6, backgroundColor: '#333333', marginHorizontal: 24, marginTop: Platform.OS === 'ios' ? 8 : 24, borderRadius: 3 },
  progressBar: { height: '100%', backgroundColor: '#00E0B0', borderRadius: 3 },
  stepIndicator: { color: '#B0B0B0', fontSize: 14, textAlign: 'center', marginVertical: 16 },
  contentArea: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, },
  stepContainer: { width: '100%', alignItems: 'center', paddingBottom: 20 }, // Added paddingBottom
  title: { fontSize: 24, fontWeight: '600', color: '#FFFFFF', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#B0B0B0', marginBottom: 30, textAlign: 'center', lineHeight: 22, paddingHorizontal: 10 },
  input: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 18,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  primaryButton: { // For main action on Step 0
    backgroundColor: '#00E0B0',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 10, // Added margin top
    minHeight: 52,
  },
  primaryButtonNav: { // For Next/Finish in the footer
    backgroundColor: '#00E0B0',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
    minHeight: 52,
  },
  primaryButtonText: { color: '#121212', fontWeight: '600', fontSize: 16 },
  secondaryButton: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
    borderWidth: 1,
    borderColor: '#333333',
    minHeight: 52,
  },
  secondaryButtonText: { color: '#FFFFFF', fontWeight: '500', fontSize: 16 },
  disabledButton: { opacity: 0.5 },
  optionButton: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  optionIcon: { marginRight: 10 },
  optionButtonText: { color: '#FFFFFF', fontWeight: '500', fontSize: 16 },
  skipButton: { paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  skipButtonText: { color: '#00E0B0', fontSize: 14, fontWeight: '500' },
  linkText: { color: '#00E0B0', textAlign: 'center', marginTop: 20, fontSize: 15 },
  navigationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: Platform.OS === 'ios' ? 16 : 20, // More padding for Android bottom
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
    backgroundColor: '#121212', // Ensure footer bg matches screen
  },
});

export default OnboardingScreen;