import { Component, type ErrorInfo, type ReactNode } from 'react';
import { tr } from '../i18n';

/** Last-resort guard: a rendering crash shows a recoverable message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('UI error:', error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="state state--tall" role="alert">
        <h1 className="h2">{tr('cErrorBoundary.1', 'مشکلی پیش آمد')}</h1>
        <p className="muted">{tr('cErrorBoundary.2', 'صفحه را دوباره بارگذاری کنید. اگر مشکل ادامه داشت، بعداً تلاش کنید.')}</p>
        <button className="btn btn--sm" onClick={() => window.location.reload()}>{tr('cErrorBoundary.3', 'بارگذاری دوباره')}</button>
      </div>
    );
  }
}
