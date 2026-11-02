import { useEffect } from 'react';
import { useConfirm } from './confirmStore';

export function ConfirmHost() {
  const { request, dismiss } = useConfirm();
  useEffect(() => {
    if (request === null) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request, dismiss]);
  if (request === null) return null;
  return (
    <div className="modal-backdrop confirm-backdrop" onClick={dismiss}>
      <div className="modal confirm" role="alertdialog" onClick={(e) => e.stopPropagation()}>
        <h2>{request.title}</h2>
        <p>{request.message}</p>
        <div className="row">
          <button type="button" autoFocus onClick={dismiss}>
            {request.cancelLabel}
          </button>
          <button type="button" className="danger" onClick={() => (dismiss(), request.onConfirm())}>
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
