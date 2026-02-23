import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import i18n from '@/i18n';

interface Props {
  children?: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class TabErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('TabErrorBoundary caught:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      const t = (key: string, fallback?: string) => i18n.t(key, { defaultValue: fallback });
      return (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-6 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 mx-auto text-destructive/70" />
            <p className="text-sm font-medium text-destructive">
              {t('tabError.title', 'This section encountered a problem')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('tabError.message', 'Try again or switch to another tab.')}
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <p className="text-xs text-destructive/60 font-mono break-all">{this.state.error.message}</p>
            )}
            <Button size="sm" variant="outline" onClick={this.handleRetry} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              {t('tabError.retry', 'Try Again')}
            </Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

export default TabErrorBoundary;
