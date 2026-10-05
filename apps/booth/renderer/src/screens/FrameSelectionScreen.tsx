import React, { useEffect, useState } from 'react';
import { FrameConfig } from '@photo-booth/types';
import { MOCK_FRAMES } from '../data/mockData';
import { useFramesWithDrafts } from '../hooks/useFramesWithDrafts';
import { listFrameTemplates } from '../lib/frames';
import { useSessionStore } from '../store/sessionStore';
import { useBoothAppearance } from '../store/appearanceStore';
import FrameSelectionView from '../components/booth/FrameSelectionView';

export const FrameSelectionScreen: React.FC = () => {
  const selectFrame = useSessionStore((state) => state.selectFrame);
  const { copy, theme } = useBoothAppearance((state) => state.active);
  const [frames, setFrames] = useState<FrameConfig[]>(MOCK_FRAMES);
  const [isLoading, setIsLoading] = useState(true);
  const framesWithDrafts = useFramesWithDrafts(frames, 3);
  const [selected, setSelected] = useState<FrameConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    listFrameTemplates()
      .then((remote) => {
        if (!cancelled && remote.length > 0) {
          setFrames(remote);
        }
      })
      .catch(() => {
        // Fall back to local MOCK_FRAMES when Supabase is unreachable/unconfigured.
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConfirm = () => {
    if (selected) {
      selectFrame(selected);
    }
  };

  return (
    <div className="relative h-[calc(100vh-3rem)]">
      <FrameSelectionView
        copy={copy}
        theme={theme}
        frames={framesWithDrafts}
        isLoading={isLoading}
        selected={selected}
        onSelect={setSelected}
        onClose={() => setSelected(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default FrameSelectionScreen;
