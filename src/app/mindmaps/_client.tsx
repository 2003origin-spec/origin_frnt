'use client';
import { useRouter } from 'next/navigation';
import { Share2 } from 'lucide-react';
import ComingSoon from '@/components/ui/ComingSoon';

export default function MindmapsClient() {
  const router = useRouter();
  return (
    <ComingSoon
      icon={Share2}
      title="Mindmaps"
      description="Every chapter as one visual map, so revision is a glance instead of a re-read."
      bullets={[
        'One map per chapter, built from the syllabus',
        'Formulae and links where you expect them',
        'Marks the topics you keep getting wrong',
      ]}
      mascot="/ori2d/ori-reading.png"
      action={{ label: 'Open Study Corner', onClick: () => router.push('/study-corner') }}
    />
  );
}
