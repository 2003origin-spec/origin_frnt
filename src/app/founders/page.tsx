import type { Metadata } from 'next';
import MeetFounders from '@/components/landing/MeetFounders';

export const metadata: Metadata = {
  title: 'The Minds Behind O3Origin',
  description: 'Meet the founders of O3Origin — the team building an AI-native study companion for JEE & NEET aspirants.',
};

export default function FoundersPage() {
  return <MeetFounders />;
}
