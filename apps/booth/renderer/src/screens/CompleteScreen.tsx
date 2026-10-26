import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useBoothAppearance } from '../store/appearanceStore';
import { useGlobalBoothSettings } from '../lib/boothSettings';
import { updateSessionRecord } from '../lib/sessions';
import CompleteView from '../components/booth/CompleteView';
import ConsentView from '../components/booth/ConsentView';

/** Seconds before the booth returns to the start screen on its own. */
const AUTO_RESET_SECONDS = 8;
/** Seconds a guest has to answer the social media question before the booth moves on. */
const CONSENT_TIMEOUT_SECONDS = 30;

export const CompleteScreen: React.FC = () => {
  const resetSession = useSessionStore((state) => state.resetSession);
  const sessionToken = useSessionStore((state) => state.sessionToken);
  const { copy, theme } = useBoothAppearance((state) => state.appearance);
  // Asked only when the admin switched it on and the session has a record to
  // store the answer on. Read once on entry so a live toggle never swaps the
  // screen out from under a guest.
  const consentEnabled = useGlobalBoothSettings((state) => state.settings?.socialConsent === true);
  const [askConsent] = useState(() => consentEnabled && Boolean(sessionToken));
  const [answered, setAnswered] = useState(false);
  const asking = askConsent && !answered;

  // Auto reset: after the thank-you, or when nobody answers the question
  // (no answer is stored: the column stays null).
  useEffect(() => {
    const seconds = asking ? CONSENT_TIMEOUT_SECONDS : AUTO_RESET_SECONDS;
    const timer = setTimeout(() => {
      resetSession();
    }, seconds * 1000);

    return () => clearTimeout(timer);
  }, [asking, resetSession]);

  const answer = (consent: boolean) => {
    if (sessionToken) {
      updateSessionRecord(sessionToken, { social_consent: consent, social_consent_at: new Date().toISOString() });
    }
    setAnswered(true);
  };

  return (
    // Definite height so the views' `h-full` + `items-center` can actually
    // center (see TutorialScreen for the same note).
    <div className="h-[calc(100dvh-3rem)]">
      {asking ? (
        <ConsentView copy={copy} theme={theme} onAnswer={answer} timeoutSeconds={CONSENT_TIMEOUT_SECONDS} />
      ) : (
        <CompleteView
          copy={copy}
          theme={theme}
          onDone={resetSession}
          autoResetSeconds={AUTO_RESET_SECONDS}
          note={answered ? copy.consentThanks : undefined}
        />
      )}
    </div>
  );
};
export default CompleteScreen;
