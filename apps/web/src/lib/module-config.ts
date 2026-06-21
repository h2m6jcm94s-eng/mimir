import {
  Briefcase,
  CalendarClock,
  Dumbbell,
  type LucideIcon,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Plane,
  Salad,
  ScreenShare,
  UserSquare,
  Users,
  Wand2,
} from 'lucide-react';

export type PersonalModuleKind =
  | 'finance'
  | 'nutrition'
  | 'fitness'
  | 'travel'
  | 'tutor'
  | 'meeting'
  | 'email'
  | 'screenTime'
  | 'conversation'
  | 'suggestion'
  | 'family'
  | 'hr';

export interface ModuleConfig {
  kind: PersonalModuleKind;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  fields: ModuleField[];
}

export interface ModuleField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  options?: string[];
  placeholder?: string;
}

export const moduleConfigs: Record<PersonalModuleKind, ModuleConfig> = {
  finance: {
    kind: 'finance',
    label: 'Finance',
    title: 'Personal finance',
    description: 'Track spending, budgets, and financial anomalies.',
    icon: Briefcase,
    fields: [
      { key: 'amount', label: 'Amount', type: 'number', placeholder: '0.00' },
      { key: 'currency', label: 'Currency', type: 'text', placeholder: 'USD' },
      { key: 'category', label: 'Category', type: 'text', placeholder: 'e.g. Subscriptions' },
    ],
  },
  nutrition: {
    kind: 'nutrition',
    label: 'Nutrition',
    title: 'Nutrition & meal planner',
    description: 'Plan meals and build grocery lists.',
    icon: Salad,
    fields: [
      {
        key: 'meal',
        label: 'Meal',
        type: 'select',
        options: ['Breakfast', 'Lunch', 'Dinner', 'Snack'],
      },
      { key: 'calories', label: 'Calories', type: 'number', placeholder: '0' },
      {
        key: 'ingredients',
        label: 'Ingredients',
        type: 'textarea',
        placeholder: 'Comma-separated ingredients',
      },
    ],
  },
  fitness: {
    kind: 'fitness',
    label: 'Fitness',
    title: 'Fitness & workout coach',
    description: 'Log workouts and track progress.',
    icon: Dumbbell,
    fields: [
      { key: 'exercise', label: 'Exercise', type: 'text', placeholder: 'e.g. Squats' },
      { key: 'sets', label: 'Sets', type: 'number', placeholder: '3' },
      { key: 'reps', label: 'Reps', type: 'number', placeholder: '10' },
      { key: 'duration', label: 'Duration (min)', type: 'number', placeholder: '30' },
    ],
  },
  travel: {
    kind: 'travel',
    label: 'Travel',
    title: 'Travel planner',
    description: 'Build itineraries and trip checklists.',
    icon: Plane,
    fields: [
      { key: 'destination', label: 'Destination', type: 'text', placeholder: 'e.g. Kyoto' },
      { key: 'startDate', label: 'Start date', type: 'date' },
      { key: 'endDate', label: 'End date', type: 'date' },
    ],
  },
  tutor: {
    kind: 'tutor',
    label: 'Tutor',
    title: 'Adaptive tutor',
    description: 'Create learning paths and study goals.',
    icon: UserSquare,
    fields: [
      { key: 'topic', label: 'Topic', type: 'text', placeholder: 'e.g. Linear algebra' },
      {
        key: 'level',
        label: 'Level',
        type: 'select',
        options: ['Beginner', 'Intermediate', 'Advanced'],
      },
      { key: 'goal', label: 'Goal', type: 'textarea', placeholder: 'What do you want to achieve?' },
    ],
  },
  meeting: {
    kind: 'meeting',
    label: 'Meetings',
    title: 'Meeting prep',
    description: 'Prepare for meetings and draft follow-ups.',
    icon: CalendarClock,
    fields: [
      { key: 'attendees', label: 'Attendees', type: 'text', placeholder: 'Comma-separated names' },
      {
        key: 'agenda',
        label: 'Agenda',
        type: 'textarea',
        placeholder: 'What is this meeting about?',
      },
    ],
  },
  email: {
    kind: 'email',
    label: 'Inbox Zero',
    title: 'Inbox Zero assistant',
    description: 'Triage emails and draft replies.',
    icon: Mail,
    fields: [
      { key: 'sender', label: 'Sender', type: 'text', placeholder: 'sender@example.com' },
      { key: 'subject', label: 'Subject', type: 'text', placeholder: 'Email subject' },
      { key: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High'] },
    ],
  },
  screenTime: {
    kind: 'screenTime',
    label: 'Screen time',
    title: 'Digital wellbeing',
    description: 'Set screen-time goals and wellbeing habits.',
    icon: ScreenShare,
    fields: [
      { key: 'app', label: 'App / Goal', type: 'text', placeholder: 'e.g. Social media' },
      { key: 'limitMinutes', label: 'Limit (minutes)', type: 'number', placeholder: '60' },
    ],
  },
  conversation: {
    kind: 'conversation',
    label: 'Conversations',
    title: 'Difficult conversation coach',
    description: 'Role-play and draft difficult conversations.',
    icon: MessageCircle,
    fields: [
      {
        key: 'topic',
        label: 'Topic',
        type: 'text',
        placeholder: 'What is the conversation about?',
      },
      { key: 'tone', label: 'Tone', type: 'select', options: ['Gentle', 'Direct', 'Curious'] },
    ],
  },
  suggestion: {
    kind: 'suggestion',
    label: 'Suggestions',
    title: 'Proactive suggestions',
    description: 'Capture contextual suggestions and feedback.',
    icon: Wand2,
    fields: [
      {
        key: 'context',
        label: 'Context',
        type: 'textarea',
        placeholder: 'Where did this suggestion come up?',
      },
      {
        key: 'action',
        label: 'Suggested action',
        type: 'text',
        placeholder: 'What should Mimir suggest?',
      },
    ],
  },
  family: {
    kind: 'family',
    label: 'Family',
    title: 'Family mesh',
    description: 'Coordinate household tasks and shared goals.',
    icon: Users,
    fields: [
      { key: 'assignee', label: 'Assignee', type: 'text', placeholder: 'Who is responsible?' },
      { key: 'chore', label: 'Chore / Task', type: 'text', placeholder: 'e.g. Take out recycling' },
    ],
  },
  hr: {
    kind: 'hr',
    label: 'HR partner',
    title: 'HR / people partner',
    description: 'Prepare 1:1s, feedback, and hiring notes.',
    icon: MessageSquare,
    fields: [
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: ['1:1 prep', 'Feedback draft', 'Hiring note'],
      },
      { key: 'person', label: 'Person', type: 'text', placeholder: 'Name' },
    ],
  },
};

export const moduleKinds = Object.keys(moduleConfigs) as PersonalModuleKind[];
