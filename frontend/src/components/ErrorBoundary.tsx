import React from 'react';

interface Props {
  children: React.ReactNode;
}
interface State {
  failed: boolean;
}

/**
 * Keeps a rendering error on one screen from turning the whole app into a blank page.
 * Wrapped per screen with key={view}, so switching to another screen resets it.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Surfaced in the console for diagnostics; the UI shows a calm message
    console.error('Screen render error:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center" role="alert">
        <div
          className="p-5 rounded-2xl border flex flex-col items-center gap-3 shadow-sm max-w-md w-full"
          style={{ background: 'var(--sf)', borderColor: 'var(--ln)' }}
        >
          <span className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
            Не удалось показать этот экран
          </span>
          <span className="text-[13px]" style={{ color: 'var(--mu)' }}>
            Данные пришли в неожиданном виде. Остальные экраны работают — выберите другой раздел или повторите.
          </span>
          <button
            type="button"
            onClick={() => this.setState({ failed: false })}
            className="btn btn-primary px-4 min-h-[44px] text-xs font-semibold"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }
}
