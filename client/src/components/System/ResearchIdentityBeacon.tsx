import { useEffect } from 'react';
import { STUDY_ID } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks/AuthContext';

const META_NAME = 'bitlab-research-identity';

/** Exposes the non-secret research identity on the app's own origin so the
 * consented research extension can link participantId ↔ appUserId. */
export default function ResearchIdentityBeacon() {
  const { user } = useAuthContext();

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${META_NAME}"]`);
    if (meta == null) {
      meta = document.createElement('meta');
      meta.name = META_NAME;
      document.head.appendChild(meta);
    }
    meta.content = JSON.stringify({ appUserId: user.id, studyId: STUDY_ID, issuedAt: Date.now() });
    return () => {
      meta?.remove();
    };
  }, [user?.id]);

  return null;
}
