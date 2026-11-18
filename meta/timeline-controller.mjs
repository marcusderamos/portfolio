// Manual timeline choices persist until the visitor explicitly resumes scrolling.
export function createTimelineController(render) {
  let followingScroll = true;
  let latestStep = null;

  return {
    select(cutoff, activeId = null) {
      followingScroll = false;
      render(cutoff, activeId, followingScroll);
    },
    enterStep(cutoff, activeId) {
      latestStep = { cutoff, activeId };
      if (followingScroll) render(cutoff, activeId, followingScroll);
    },
    follow(enabled) {
      followingScroll = enabled;
      if (followingScroll && latestStep) {
        render(latestStep.cutoff, latestStep.activeId, followingScroll);
      }
    },
  };
}
