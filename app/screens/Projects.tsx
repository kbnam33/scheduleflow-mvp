import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import axios from 'axios';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ProjectsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Projects'>>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [progressAnims, setProgressAnims] = useState<any>({});

  useEffect(() => {
    setLoading(true);
    axios.get('/api/projects')
      .then(res => {
        setProjects(res.data.projects || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Animate progress bars on mount
  useEffect(() => {
    const anims: any = {};
    projects.forEach((p, i) => {
      anims[p.id] = new Animated.Value(0);
      Animated.timing(anims[p.id], {
        toValue: p.tasksCompleted / p.tasksTotal,
        duration: 800,
        useNativeDriver: false,
      }).start();
    });
    setProgressAnims(anims);
  }, [projects]);

  const renderProject = ({ item, index }: { item: any, index: number }) => {
    const progress = progressAnims[item.id] || new Animated.Value(0);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('Tasks', { projectId: item.id, projectTitle: item.title })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.index}>{index + 1}.</Text>
          <Text style={styles.title}>{item.title}</Text>
          <View style={{ flex: 1 }} />
          <View style={styles.phaseBadge}>
            <Text style={styles.phaseText}>{item.phase}</Text>
          </View>
        </View>
        <Text style={styles.dueDate}>Due: {item.dueDate}</Text>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Tasks completed</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.progressCount}>{item.tasksCompleted}/{item.tasksTotal}</Text>
        </View>
        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBarFill, {
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          }]} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, paddingTop: insets.top, paddingBottom: 0, backgroundColor: '#0B0F11' }}>
      <StatusBar barStyle="light-content" translucent={true} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.container, { paddingBottom: 76 + insets.bottom }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.headerBack}>{'<'}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Projects</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity>
              <Text style={styles.headerMenu}>⋮</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color="#6ee7b7" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={projects}
              renderItem={renderProject}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
            />
          )}
          <View style={styles.fab}>
            <TouchableOpacity style={styles.addButton}>
              <Text style={styles.addButtonIcon}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Bottom Navigation */}
        <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity 
            style={route.name === 'Home' ? styles.navItemActive : styles.navItem}
            onPress={() => navigation.navigate('Home')}
          >
            <MaterialCommunityIcons name="home" size={24} color={route.name === 'Home' ? '#FFFFFF' : '#B0B0B0'} />
            <Text style={route.name === 'Home' ? styles.navLabelActive : styles.navLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={route.name === 'Calendar' ? styles.navItemActive : styles.navItem}
            onPress={() => navigation.navigate('Calendar')}
          >
            <MaterialCommunityIcons name="calendar" size={24} color={route.name === 'Calendar' ? '#FFFFFF' : '#B0B0B0'} />
            <Text style={route.name === 'Calendar' ? styles.navLabelActive : styles.navLabel}>Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={route.name === 'Chat' ? styles.navItemActive : styles.navItem}
            onPress={() => navigation.navigate('Chat')}
          >
            <MaterialCommunityIcons name="chat" size={24} color={route.name === 'Chat' ? '#FFFFFF' : '#B0B0B0'} />
            <Text style={route.name === 'Chat' ? styles.navLabelActive : styles.navLabel}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={route.name === 'Projects' ? styles.navItemActive : styles.navItem}
            onPress={() => navigation.navigate('Projects')}
          >
            <MaterialCommunityIcons name="folder" size={24} color={route.name === 'Projects' ? '#FFFFFF' : '#B0B0B0'} />
            <Text style={route.name === 'Projects' ? styles.navLabelActive : styles.navLabel}>Projects</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F11',
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  headerBack: {
    color: '#bfc6c9',
    fontSize: 22,
    marginRight: 8,
  },
  headerTitle: {
    color: '#e6ecec',
    fontSize: 22,
    fontWeight: '600',
    marginRight: 8,
  },
  headerMenu: {
    color: '#bfc6c9',
    fontSize: 22,
    marginLeft: 8,
  },
  card: {
    backgroundColor: '#151A1E',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  index: {
    color: '#6ee7b7',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  title: {
    color: '#e6ecec',
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  phaseBadge: {
    backgroundColor: '#7CB8FF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginLeft: 8,
  },
  phaseText: {
    color: '#0B0F11',
    fontSize: 13,
  },
  dueDate: {
    color: '#A3B3C2',
    fontSize: 13,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#222',
    marginVertical: 8,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    color: '#F5F7FA',
    fontSize: 13,
  },
  progressCount: {
    color: '#F5F7FA',
    fontSize: 13,
    marginLeft: 8,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#1F272D',
    borderRadius: 3,
    marginTop: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#7CB8FF',
    borderRadius: 3,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    marginTop: 8,
  },
  navItem: {
    alignItems: 'center',
    opacity: 0.6,
  },
  navItemActive: {
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    padding: 8,
    borderRadius: 12,
  },
  icon: {
    fontSize: 20,
    color: '#bfc6c9',
  },
  iconActive: {
    fontSize: 20,
    color: '#e6ecec',
  },
  navLabel: {
    color: '#bfc6c9',
    fontSize: 12,
    marginTop: 2,
  },
  navLabelActive: {
    color: '#e6ecec',
    fontSize: 12,
    marginTop: 2,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#7CB8FF',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonIcon: {
    fontSize: 20,
    color: '#0B0F11',
  },
});

export default ProjectsScreen; 