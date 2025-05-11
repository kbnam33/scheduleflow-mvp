import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  LayoutAnimation,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';

type RootStackParamList = {
  Home: undefined;
  Calendar: undefined;
  Chat: undefined;
  Tasks: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const TasksScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiTasks, setAiTasks] = useState([]);
  const [loadingGen, setLoadingGen] = useState(false);
  const [toast, setToast] = useState(null);
  const [projectBrief, setProjectBrief] = useState('');
  const [projectId, setProjectId] = useState('project-123');
  const userId = 'test-user';

  useEffect(() => {
    // Simulated data loading
    setLoading(false);
    setTasks([
      {
        id: 1,
        title: 'Review Q4 Financials',
        description: 'Analyze and prepare presentation for board meeting',
        dueDate: 'Dec 15, 2023',
        priority: 'high',
        status: 'in-progress',
      },
      {
        id: 2,
        title: 'Team Sync Meeting',
        description: 'Weekly team sync to discuss progress and blockers',
        dueDate: 'Dec 12, 2023',
        priority: 'medium',
        status: 'pending',
      },
      {
        id: 3,
        title: 'Project Documentation',
        description: 'Update project documentation with latest changes',
        dueDate: 'Dec 20, 2023',
        priority: 'low',
        status: 'pending',
      },
    ]);
  }, []);

  const handleGenerateTasks = async () => {
    setLoadingGen(true);
    setToast(null);
    try {
      const res = await axios.post('http://localhost:3001/api/generate-tasks', { projectBrief, userId, projectId });
      setAiTasks(res.data.tasks || []);
      setToast('Tasks generated!');
    } catch {
      setToast('Failed to generate tasks. Tap to retry.');
    } finally {
      setLoadingGen(false);
    }
  };

  const renderTaskCard = ({ item }: { item: any }) => (
    <View style={styles.taskCard}>
      <View style={styles.taskHeader}>
        <View style={styles.taskTitleContainer}>
          <MaterialCommunityIcons
            name={item.status === 'completed' ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
            size={24}
            color={item.status === 'completed' ? '#6ee7b7' : '#bfc6c9'}
          />
          <Text style={styles.taskTitle}>{item.title}</Text>
        </View>
        <TouchableOpacity style={styles.taskMenu}>
          <MaterialCommunityIcons name="dots-vertical" size={20} color="#bfc6c9" />
        </TouchableOpacity>
      </View>
      <Text style={styles.taskDescription}>{item.description}</Text>
      <View style={styles.taskFooter}>
        <View style={[
          styles.priorityBadge,
          { backgroundColor: item.priority === 'high' ? '#ef4444' : item.priority === 'medium' ? '#f59e0b' : '#6ee7b7' }
        ]}>
          <Text style={styles.priorityText}>{item.priority}</Text>
        </View>
        <Text style={styles.dueDate}>Due: {item.dueDate}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tasks</Text>
          <TouchableOpacity style={styles.addButton}>
            <MaterialCommunityIcons name="plus" size={24} color="#e6ecec" />
          </TouchableOpacity>
        </View>

        <View style={styles.filterContainer}>
          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterText}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterButton, styles.filterButtonActive]}>
            <Text style={[styles.filterText, styles.filterTextActive]}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterText}>Completed</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={tasks}
          renderItem={renderTaskCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.tasksList}
        />

        {/* Generate Tasks button */}
        <TouchableOpacity onPress={handleGenerateTasks} style={{margin:16,padding:12,backgroundColor:'#00CFA8',borderRadius:8,alignItems:'center'}}>
          <Text style={{color:'#fff',fontWeight:'bold'}}>Generate Tasks</Text>
        </TouchableOpacity>
        {loadingGen && <ActivityIndicator color="#00CFA8" style={{margin:16}} />}

        {/* AI Tasks card */}
        {aiTasks.length > 0 && (
          <View style={{backgroundColor:'#151A1E',borderRadius:12,padding:16,margin:16}}>
            <Text style={{color:'#00CFA8',fontWeight:'bold',marginBottom:8}}>AI-Suggested Tasks</Text>
            {aiTasks.map((task, idx) => (
              <View key={task.id || idx} style={{marginBottom:8}}>
                <Text style={{color:'#fff',fontWeight:'bold'}}>{task.title}</Text>
                <Text style={{color:'#A3B3C2'}}>{task.description}</Text>
                <Text style={{color:'#A3B3C2',fontSize:12}}>Due: {task.dueDate}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Toast */}
        {toast && (
          <TouchableOpacity onPress={toast.startsWith('Failed') ? handleGenerateTasks : undefined} style={{position:'absolute',left:20,right:20,bottom:100,backgroundColor:'#1E1E1E',borderRadius:12,padding:16,alignItems:'center'}}>
            <Text style={{color:'#fff'}}>{toast}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Home')}
        >
          <MaterialCommunityIcons name="home" size={24} color="#bfc6c9" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Calendar')}
        >
          <MaterialCommunityIcons name="calendar" size={24} color="#bfc6c9" />
          <Text style={styles.navLabel}>Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Chat')}
        >
          <MaterialCommunityIcons name="chat" size={24} color="#bfc6c9" />
          <Text style={styles.navLabel}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItemActive}
          onPress={() => navigation.navigate('Tasks')}
        >
          <MaterialCommunityIcons name="file-document-outline" size={24} color="#e6ecec" />
          <Text style={styles.navLabelActive}>Tasks</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F11',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B0F11',
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  headerTitle: {
    color: '#F5F7FA',
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#181818',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#181818',
    marginRight: 12,
  },
  filterButtonActive: {
    backgroundColor: '#e6ecec',
  },
  filterText: {
    color: '#bfc6c9',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#0a0a0a',
  },
  tasksList: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  taskCard: {
    backgroundColor: '#151A1E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  taskTitle: {
    color: '#F5F7FA',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  taskMenu: {
    padding: 8,
  },
  taskDescription: {
    color: '#bfc6c9',
    fontSize: 12,
    marginBottom: 16,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priorityBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  priorityText: {
    color: '#0a0a0a',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  dueDate: {
    color: '#bfc6c9',
    fontSize: 12,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#121212',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: {
    alignItems: 'center',
    opacity: 0.6,
  },
  navItemActive: {
    alignItems: 'center',
    opacity: 1,
  },
  navLabel: {
    color: '#bfc6c9',
    fontSize: 12,
    marginTop: 4,
  },
  navLabelActive: {
    color: '#e6ecec',
    fontSize: 12,
    marginTop: 4,
    fontWeight: 'bold',
  },
});

export default TasksScreen; 