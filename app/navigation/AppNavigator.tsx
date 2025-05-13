import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import OnboardingScreen from '../screens/onboarding';
import HomeScreen from '../screens/Home';
import CalendarScreen from '../screens/calendar';
import ChatScreen from '../screens/chat';
import ProjectsScreen from '../screens/Projects';
import TasksScreen from '../screens/Tasks';
import AssetsScreen from '../screens/Assets';
// import CustomTabBar from '../components/CustomTabBar';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer theme={{...DefaultTheme, colors: {...DefaultTheme.colors, background: '#121212'}}}>
      <Stack.Navigator
        id={undefined}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Calendar" component={CalendarScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Projects" component={ProjectsScreen} />
        <Stack.Screen name="Tasks" component={TasksScreen} />
        <Stack.Screen name="Assets" component={AssetsScreen} />
      </Stack.Navigator>
      {/* <CustomTabBar /> */}
    </NavigationContainer>
  );
};

export default AppNavigator;