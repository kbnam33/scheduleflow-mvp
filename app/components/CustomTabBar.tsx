import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const TABS = [
  { name: 'Home', icon: 'home' },
  { name: 'Calendar', icon: 'calendar' },
  { name: 'Chat', icon: 'chat' },
  { name: 'Projects', icon: 'folder' },
  { name: 'Tasks', icon: 'file-document-outline' },
  { name: 'Assets', icon: 'clipboard-text' },
];

const CustomTabBar = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [active, setActive] = useState('Home');
  const [underline] = useState(new Animated.Value(0));
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    setActive(route.name);
    Animated.spring(underline, {
      toValue: TABS.findIndex(t => t.name === route.name),
      useNativeDriver: false,
      speed: 20,
      bounciness: 8,
    }).start();
  }, [route.name]);

  // Simulate unread dot for Chat
  useEffect(() => {
    if (active === 'Chat') setUnread(false);
    else if (active !== 'Chat') setUnread(true);
  }, [active]);

  return (
    <View style={styles.tabBar}>
      {TABS.map((tab, idx) => {
        const isActive = active === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => navigation.navigate(tab.name as never)}
            activeOpacity={0.8}
          >
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name={tab.icon as any}
                size={24}
                color={isActive ? '#00E0B0' : '#666'}
              />
              {tab.name === 'Chat' && unread && (
                <Animated.View style={styles.unreadDot} />
              )}
            </View>
            {isActive && (
              <Animated.Text style={styles.label}>{tab.name}</Animated.Text>
            )}
            {isActive && (
              <Animated.View style={[styles.underline, { left: `${idx * 100 / TABS.length}%`, width: `${100 / TABS.length}%` }]} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121212',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    height: 56 + (Platform.OS === 'ios' ? 16 : 0),
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 16 : 0,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    paddingVertical: 4,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    marginTop: 4,
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    backgroundColor: '#00E0B0',
    borderRadius: 2,
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00CFA8',
  },
});

export default CustomTabBar; 