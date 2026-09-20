'use client';
import { useRouter } from 'next/navigation';
import { Camera } from 'lucide-react';
import ComingSoon from '@/components/ui/ComingSoon';

export default function SnapSolveClient() {
  const router = useRouter();
  return (
    <ComingSoon
      icon={Camera}
      title="Snap & Solve"
      description="Point your camera at any question — printed, handwritten or on a screen — and get a worked solution back."
      bullets={[
        'Photograph a question from any book',
        'Full step-by-step working, not just the answer',
        'Saves straight into your practice history',
      ]}
      mascot="/ori2d/ori-thinking.png"
      action={{ label: 'Ask Ori instead', onClick: () => router.push('/doubt-solver') }}
    />
  );
}
