
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import i18n from '@/i18n';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class DashboardErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dashboard Error Details:', { error: error.message, stack: error.stack, componentStack: errorInfo.componentStack });
    this.setState({ error, errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const t = (key: string) => i18n.t(key);
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-xl text-red-800">{t('dashboardError.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-muted-foreground">{t('dashboardError.message')}</p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 p-4 bg-gray-100 rounded text-sm">
                  <summary className="cursor-pointer font-medium text-red-600 mb-2">{t('dashboardError.technicalDetails')}</summary>
                  <div className="text-red-800 space-y-2">
                    <div><strong>{t('dashboardError.errorLabel')}</strong> {this.state.error.message}</div>
                    {this.state.error.stack && (
                      <div><strong>{t('dashboardError.detailsLabel')}</strong><pre className="whitespace-pre-wrap text-xs mt-1 bg-white p-2 rounded">{this.state.error.stack}</pre></div>
                    )}
                  </div>
                </details>
              )}
              <Button onClick={this.handleRetry} className="w-full flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />{t('dashboardError.retry')}
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

export default DashboardErrorBoundary;
