import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Logger } from '~/util/Logger';

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Kiosk-grade error boundary (WOW-007D, prompted by a black-screen report):
 * without one, any uncaught render error unmounts the entire React tree and
 * the installation shows a bare black page with no recovery path short of
 * someone finding the machine. This catches the crash, logs it, and offers a
 * single obvious touch target that reloads the app — themed so it reads as
 * part of the show rather than a stack trace.
 *
 * A class component by necessity: error boundaries have no hook equivalent.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    Logger.error('Uncaught render error reached the app boundary', error, errorInfo);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className='flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-grimoire-page px-8 text-center font-data text-parchment'>
        <h1 className='font-display text-3xl tracking-[0.14em] text-gold-bright'>
          The spell fizzled…
        </h1>
        <p className='max-w-md text-[16px] text-parchment/80'>
          Something in the grimoire misfired. The music is unharmed — tap below and the page
          reassembles itself.
        </p>
        <button
          type='button'
          onClick={() => window.location.reload()}
          className='flex min-h-[56px] items-center rounded-lg border border-gold-line/60 bg-ink-btn px-8 font-data text-base tracking-wide text-parchment'
        >
          Restore the page ✦
        </button>
      </div>
    );
  }
}
