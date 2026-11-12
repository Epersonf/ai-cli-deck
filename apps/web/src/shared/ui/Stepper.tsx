import type { ReactNode } from 'react';
import { CheckIcon } from './ShapeIcons';

export interface Step {
  id: string;
  title: string;
  /** Shown only while this is the current step. */
  body?: ReactNode;
}

/** Numbered steps: finished ones fold to a tick line, only the current one is open, the rest wait. */
export function Stepper({ steps, current }: { steps: readonly Step[]; current: number }) {
  return (
    <ol className="stepper">
      {steps.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li
            key={step.id}
            className={`step ${state}`}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className="step-mark" aria-hidden>
              {state === 'done' ? <CheckIcon size={14} /> : i + 1}
            </span>
            <div className="step-main">
              <span className="step-title">{step.title}</span>
              {state === 'current' && step.body !== undefined && (
                <div className="step-body">{step.body}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
