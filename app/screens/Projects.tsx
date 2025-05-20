import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const STUB_PROJECTS = [
  { id: '1', title: "Guvata’s re-branding", dueDate: 'May 07, 2025', phase: 'Branding', tasksCompleted: 11, tasksTotal: 25 },
  { id: '2', title: "Zaraa’s Instagram strategy", dueDate: 'May 11, 2025', phase: 'Scheduling Posts', tasksCompleted: 8, tasksTotal: 10 },
  { id: '3', title: "Hemper’s website", dueDate: 'May 15, 2025', phase: 'Development', tasksCompleted: 0, tasksTotal: 9 },
];

const ProjectsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Projects'>>();
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState<any[]>(STUB_PROJECTS);
  const [loading, setLoading] = useState<boolean>(false);
  const [anims, setAnims] = useState<Record<string, Animated.Value>>({});

  useEffect(() => {
    setLoading(true);
    axios.get('/api/projects')
      .then(res => {
        setProjects(res.data.projects || STUB_PROJECTS);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const map: Record<string, Animated.Value> = {};
    projects.forEach(p => {
      const val = new Animated.Value(0);
      Animated.timing(val, {
        toValue: p.tasksCompleted / p.tasksTotal,
        duration: 800,
        useNativeDriver: false,
      }).start();
      map[p.id] = val;
    });
    setAnims(map);
  }, [projects]);

  const renderProject = ({ item, index }: { item: any; index: number }) => {
    const progAnim = anims[item.id] || new Animated.Value(0);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Tasks', { projectId: item.id, projectTitle: item.title })}
        activeOpacity={0.9}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.index}>{index + 1}.</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.due}>Due: {item.dueDate}</Text>
          </View>
          <View style={styles.phaseBadge}>
            <Text style={styles.phaseText}>Phase: {item.phase}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>Tasks completed</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.progressCount}>{item.tasksCompleted}/{item.tasksTotal}</Text>
        </View>
        <View style={styles.progressBarBg}>
          <Animated.View
            style={[styles.progressBarFill, {
              width: progAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
            }]}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>      
      <StatusBar barStyle="light-content" translucent />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Projects</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity>
          <MaterialCommunityIcons name="dots-vertical" size={24} color="#B0B0B0" />
        </TouchableOpacity>
      </View>
      {/* List */}
      {loading ? (
        <ActivityIndicator color="#00E0B0" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={projects}
          renderItem={renderProject}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}
      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => {/* TODO: Add Project */}}
      >
        <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
      </TouchableOpacity>
      {/* Bottom Nav */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom }]}>  
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <MaterialCommunityIcons name="home" size={24} color="#B0B0B0" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Calendar')}>
          <MaterialCommunityIcons name="calendar" size={24} color="#B0B0B0" />
          <Text style={styles.navLabel}>Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Chat')}>
          <MaterialCommunityIcons name="chat" size={24} color="#B0B0B0" />
          <Text style={styles.navLabel}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItemActive} onPress={() => navigation.navigate('Projects')}>
          <MaterialCommunityIcons name="file-document-outline" size={24} color="#FFFFFF" />
          <Text style={styles.navLabelActive}>Projects</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0B0F11' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '600', marginLeft: 12 },
  card: { backgroundColor: '#151A1E', borderRadius: 12, marginBottom: 16, padding: 16, marginHorizontal: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  index: { color: '#FFFFFF', fontSize: 16, marginRight: 8 },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  due: { color: '#A3B3C2', fontSize: 13, marginTop: 4 },
  phaseBadge: { backgroundColor: '#2A2A2A', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 8, marginLeft: 8 },
  phaseText: { color: '#FFFFFF', fontSize: 12 },
  divider: { height: 1, backgroundColor: '#222', marginVertical: 12 },
  progressSection: { flexDirection: 'row', alignItems: 'center' },
  progressLabel: { color: '#F5F7FA', fontSize: 13 },
  progressCount: { color: '#F5F7FA', fontSize: 13 },
  progressBarBg: { height: 6, backgroundColor: '#222', borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  progressBarFill: { height: 6, backgroundColor: '#00E0B0' },
  fab: { position: 'absolute', right: 16, backgroundColor: '#00E0B0', padding: 12, borderRadius: 24, elevation: 5 },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#121212', borderTopWidth: 1, borderTopColor: '#2A2A2A' },
  navItem: { alignItems: 'center', opacity: 0.6 },
  navItemActive: { alignItems: 'center', backgroundColor: '#1E1E1E', padding: 8, borderRadius: 12 },
  navLabel: { color: '#B0B0B0', fontSize: 12, marginTop: 4 },
  navLabelActive: { color: '#FFFFFF', fontSize: 12, marginTop: 4, fontWeight: '600' },
});
// git change..

export default ProjectsScreen;
