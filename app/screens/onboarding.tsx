import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Define the navigation prop type
type OnboardingScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Onboarding'
>;

// Define the component as a proper React FC
const OnboardingScreen: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(false);
  const [role, setRole] = useState('');
  const [creativeTime, setCreativeTime] = useState('');

  // Explicitly type the navigation
  const navigation = useNavigation<OnboardingScreenNavigationProp>();

  const insets = useSafeAreaInsets();

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      // Validate email and password
      if (!email || !password) {
        Alert.alert('Error', 'Please fill in all fields');
        return;
      }

      if (!validateEmail(email)) {
        Alert.alert('Error', 'Please enter a valid email address');
        return;
      }

      if (!validatePassword(password)) {
        Alert.alert('Error', 'Password must be at least 6 characters long');
        return;
      }

      if (!isLogin && password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }

      try {
        // Here you would typically make an API call to your backend
        // For now, we'll just proceed to the next step
        setCurrentStep(prev => prev + 1);
      } catch (error) {
        Alert.alert('Error', 'Failed to authenticate. Please try again.');
      }
      return;
    }

    if (currentStep === 1) {
      // Calendar connection step
      try {
        await axios.get('http://localhost:3001/api/health');
        setCurrentStep(prev => prev + 1);
      } catch (error) {
        Alert.alert('Warning', 'Calendar connection failed. You can try again later.');
        setCurrentStep(prev => prev + 1);
      }
      return;
    }

    if (currentStep === 2) {
      // Video app connection step
      try {
        await axios.post('http://localhost:3001/api/health');
        setCurrentStep(prev => prev + 1);
      } catch (error) {
        Alert.alert('Warning', 'Video app connection failed. You can try again later.');
        setCurrentStep(prev => prev + 1);
      }
      return;
    }

    if (currentStep === 3) {
      // Role selection step
      if (!role) {
        Alert.alert('Error', 'Please select your role');
        return;
      }
      setCurrentStep(prev => prev + 1);
      return;
    }

    if (currentStep === 4) {
      // Creative time selection step
      if (!creativeTime) {
        Alert.alert('Error', 'Please select your most creative time');
        return;
      }
      // Navigate to Home
      navigation.navigate('Home');
      return;
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>{isLogin ? 'Log In' : 'Sign Up'}</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            {!isLogin && (
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            )}
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => setIsLogin(!isLogin)}
            >
              <Text style={styles.toggleText}>
                {isLogin ? 'Need an account? Sign Up' : 'Have an account? Log In'}
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Connect Your Calendar</Text>
            <TouchableOpacity style={styles.connectButton}>
              <Text style={styles.buttonText}>Google Calendar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.connectButton}>
              <Text style={styles.buttonText}>Apple Calendar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.connectButton}>
              <Text style={styles.buttonText}>Outlook Calendar</Text>
            </TouchableOpacity>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Connect Video Apps</Text>
            <TouchableOpacity style={styles.connectButton}>
              <Text style={styles.buttonText}>Google Meet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.connectButton}>
              <Text style={styles.buttonText}>Zoom</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.connectButton}>
              <Text style={styles.buttonText}>Microsoft Teams</Text>
            </TouchableOpacity>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>What's your role?</Text>
            <TouchableOpacity
              style={[styles.radioButton, role === 'designer' && styles.radioButtonSelected]}
              onPress={() => setRole('designer')}
            >
              <Text style={styles.radioText}>Graphic Designer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.radioButton, role === 'developer' && styles.radioButtonSelected]}
              onPress={() => setRole('developer')}
            >
              <Text style={styles.radioText}>Developer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.radioButton, role === 'writer' && styles.radioButtonSelected]}
              onPress={() => setRole('writer')}
            >
              <Text style={styles.radioText}>Content Writer</Text>
            </TouchableOpacity>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>When are you most creative?</Text>
            <TouchableOpacity
              style={[styles.radioButton, creativeTime === 'morning' && styles.radioButtonSelected]}
              onPress={() => setCreativeTime('morning')}
            >
              <Text style={styles.radioText}>Morning (6AM - 12PM)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.radioButton, creativeTime === 'afternoon' && styles.radioButtonSelected]}
              onPress={() => setCreativeTime('afternoon')}
            >
              <Text style={styles.radioText}>Afternoon (12PM - 6PM)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.radioButton, creativeTime === 'evening' && styles.radioButtonSelected]}
              onPress={() => setCreativeTime('evening')}
            >
              <Text style={styles.radioText}>Evening (6PM - 12AM)</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, paddingTop: insets.top, paddingBottom: 0, backgroundColor: '#121212' }}>
      <StatusBar barStyle="light-content" translucent={true} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 76 + insets.bottom }}>
          {renderStep()}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
          <View style={styles.progressDots}>
            {[0, 1, 2, 3, 4].map(step => (
              <View
                key={step}
                style={[
                  styles.dot,
                  currentStep === step && styles.activeDot,
                ]}
              />
            ))}
          </View>
          <View style={styles.navigationButtons}>
            {currentStep > 0 && (
              <TouchableOpacity style={styles.navButton} onPress={handleBack}>
                <Text style={styles.navButtonText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.navButton} onPress={handleNext}>
              <Text style={styles.navButtonText}>
                {currentStep === 4 ? 'Finish' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    color: '#fff',
  },
  connectButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  toggleButton: {
    marginTop: 15,
  },
  toggleText: {
    color: '#666',
    fontSize: 14,
  },
  radioButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  radioButtonSelected: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#fff',
  },
  radioText: {
    color: '#fff',
    fontSize: 16,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#fff',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navButton: {
    flex: 1,
    height: 50,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default OnboardingScreen;