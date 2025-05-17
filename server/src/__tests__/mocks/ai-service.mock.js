const mockAIResponse = {
  message: 'Test AI response',
  suggestedActions: [
    { type: 'SCHEDULE_FOCUS_BLOCK', description: 'Create a focus block in your calendar' },
    { type: 'CREATE_TASK', description: 'Add this as a task' }
  ]
};

const mockTaskSuggestions = [
  {
    title: 'Test task 1',
    description: 'Test description 1',
    priority: 'high',
    dueDate: new Date().toISOString()
  },
  {
    title: 'Test task 2',
    description: 'Test description 2',
    priority: 'medium',
    dueDate: new Date().toISOString()
  }
];

const mockFocusBlockSuggestions = [
  {
    startTime: new Date().toISOString(),
    duration: 60,
    taskId: 'test-task-1',
    type: 'focus'
  },
  {
    startTime: new Date().toISOString(),
    duration: 30,
    taskId: 'test-task-2',
    type: 'break'
  }
];

const mockEmailAnalysis = {
  summary: 'Test email summary',
  actionItems: [
    {
      title: 'Test action item 1',
      priority: 'high',
      dueDate: new Date().toISOString()
    },
    {
      title: 'Test action item 2',
      priority: 'medium',
      dueDate: new Date().toISOString()
    }
  ]
};

module.exports = {
  mockAIResponse,
  mockTaskSuggestions,
  mockFocusBlockSuggestions,
  mockEmailAnalysis
}; 