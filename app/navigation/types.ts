import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  Calendar: undefined;
  Chat: undefined;
  Projects: undefined;
  Tasks: { projectId: string; projectTitle: string };
  Assets: undefined;
};

// Convenience type for screen props
export type ScreenProps<T extends keyof RootStackParamList> = 
  NativeStackScreenProps<RootStackParamList, T>;