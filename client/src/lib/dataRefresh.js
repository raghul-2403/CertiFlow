
export const CERTIFLOW_DATA_CHANGED =
  'certiflow:data-changed';

export function notifyCertiFlowDataChanged(detail = {}) {
  window.dispatchEvent(
    new CustomEvent(CERTIFLOW_DATA_CHANGED, {
      detail,
    })
  );
}

export function subscribeToCertiFlowDataChanged(callback) {
  const handler = event => callback(event.detail);

  window.addEventListener(
    CERTIFLOW_DATA_CHANGED,
    handler
  );

  return () => {
    window.removeEventListener(
      CERTIFLOW_DATA_CHANGED,
      handler
    );
  };
}
