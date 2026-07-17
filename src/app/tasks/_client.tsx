'use client';

import { useEffect } from 'react';
import TasksGoals from '@/sections/TasksGoals';
import { useAuth } from '@/context/AuthContext';
import { useAppBack } from '@/hooks/useAppBack';
import type { Task } from '@/types';

interface TasksClientProps {
  initialTasks: Task[];
}

export default function TasksClient({ initialTasks }: TasksClientProps) {
  const { user, tasks, addTask, editTask, toggleTask, removeTask, primeTasks } = useAuth();
  const goBack = useAppBack();

  useEffect(() => {
    primeTasks(initialTasks);
  }, [initialTasks, primeTasks]);

  if (!user) return null;

  return (
    <TasksGoals
      user={user}
      tasks={tasks.length > 0 ? tasks : initialTasks}
      onAddTask={addTask}
      onEditTask={editTask}
      onToggleTask={toggleTask}
      onRemoveTask={removeTask}
      onBack={goBack}
    />
  );
}
