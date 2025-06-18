
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleRefresh = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleResetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-xl text-red-800">
                حدث خطأ غير متوقع
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-muted-foreground">
                نعتذر، حدث خطأ في التطبيق. يرجى المحاولة مرة أخرى أو العودة إلى الصفحة الرئيسية.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 p-4 bg-gray-100 rounded text-sm">
                  <summary className="cursor-pointer font-medium text-red-600 mb-2">
                    تفاصيل الخطأ (للمطورين)
                  </summary>
                  <div className="text-red-800">
                    <strong>خطأ:</strong> {this.state.error.message}
                  </div>
                  {this.state.errorInfo && (
                    <div className="mt-2">
                      <strong>مكان الخطأ:</strong>
                      <pre className="whitespace-pre-wrap text-xs mt-1">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </details>
              )}
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={this.handleRefresh}
                  className="flex items-center gap-2"
                  variant="default"
                >
                  <RefreshCw className="w-4 h-4" />
                  إعادة المحاولة
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  className="flex items-center gap-2"
                  variant="outline"
                >
                  <Home className="w-4 h-4" />
                  الصفحة الرئيسية
                </Button>
              </div>
              
              {process.env.NODE_ENV === 'development' && (
                <Button
                  onClick={this.handleResetError}
                  variant="link"
                  size="sm"
                  className="w-full"
                >
                  إعادة تعيين الخطأ (للتطوير)
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
