/** Same-tab broadcast when a study session starts or stops. */

export const DAWN_STUDY_EVENT = "dawn-study";

export type DawnStudyEventDetail = {
  live: boolean;
  sessionId?: string | null;
};

export function announceStudySession(detail: DawnStudyEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DAWN_STUDY_EVENT, { detail }));
}
