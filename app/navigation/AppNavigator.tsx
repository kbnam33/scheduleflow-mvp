// app/navigation/AppNavigator.tsx

import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';

// Casing here must match the actual filenames under app/screens/
import OnboardingScreen from '../screens/onboarding';
import LoginScreen      from '../screens/login';      // <-- Make sure login.tsx exists
import HomeScreen       from '../screens/Home';
import CalendarScreen   from '../screens/calendar';
import ChatScreen       from '../screens/chat';
import ProjectsScreen   from '../screens/Projects';
import TasksScreen      from '../screens/Tasks';
import AssetsScreen     from '../screens/Assets';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: { ...DefaultTheme.colors, background: '#121212' },
      }}
    >
      <Stack.Navigator
        id={undefined}                                  // required in this version
        initialRouteName="Onboarding"
        screenOptions={{ headerShown: false }}
      >
        {/* Auth flow */}
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Login"      component={LoginScreen} />

        {/* Main app */}
        <Stack.Screen name="Home"       component={HomeScreen} />
        <Stack.Screen name="Calendar"   component={CalendarScreen} />
        <Stack.Screen name="Chat"       component={ChatScreen} />
        <Stack.Screen name="Projects"   component={ProjectsScreen} />
        <Stack.Screen name="Tasks"      component={TasksScreen} />
        <Stack.Screen name="Assets"     component={AssetsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
// git change..

export default AppNavigator;
