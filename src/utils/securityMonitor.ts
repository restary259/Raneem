// Security monitoring and logging utilities
export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private violations: Array<{
    type: string;
    timestamp: number;
    details: any;
  }> = [];

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  // Log security violations
  logViolation(type: string, details: any) {
    const violation = {
      type,
      timestamp: Date.now(),
      details
    };
    
    this.violations.push(violation);
    
    // Keep only last 100 violations to prevent memory leaks
    if (this.violations.length > 100) {
      this.violations = this.violations.slice(-100);
    }
    
    // Log to console in development
    if (import.meta.env.DEV) {
      console.warn('[Security] Violation detected:', violation);
    }
    
    // In production, you could send this to a logging service
    this.reportViolation(violation);
  }

  // Report violations to monitoring service (placeholder)
  private reportViolation(violation: any) {
    // In a real app, you would send this to your monitoring service
    // Example: analytics.track('security_violation', violation);
  }

  // Check for common security issues
  performSecurityChecks() {
    // Check for XSS attempts in URL
    if (window.location.href.includes('<script') || 
        window.location.href.includes('javascript:')) {
      this.logViolation('xss_attempt_url', { url: window.location.href });
    }

    // Monitor for console access attempts
    this.setupConsoleMonitoring();
    
    // Check for suspicious localStorage usage
    this.monitorLocalStorage();
  }

  private setupConsoleMonitoring() {
    // Monitor console access (basic detection)
    const originalLog = console.log;
    console.log = (...args) => {
      // Check for suspicious console usage
      const message = args.join(' ');
      if (message.includes('document.cookie') || 
          message.includes('localStorage') ||
          message.includes('sessionStorage')) {
        this.logViolation('suspicious_console_access', { message });
      }
      originalLog.apply(console, args);
    };
  }

  private monitorLocalStorage() {
    // Monitor localStorage for sensitive data
    try {
      const storage = localStorage.getItem('supabase.auth.token');
      if (storage && typeof storage === 'string') {
        // Basic check for token format
        if (!storage.startsWith('{"access_token"')) {
          this.logViolation('suspicious_auth_token', { 
            tokenStart: storage.substring(0, 20) 
          });
        }
      }
    } catch (error) {
      // localStorage access failed - might be disabled or tampered
      this.logViolation('localStorage_access_denied', { error: error.message });
    }
  }

  // Initialize security monitoring
  init() {
    // Run initial security checks
    this.performSecurityChecks();
    
    // Set up CSP violation reporting
    document.addEventListener('securitypolicyviolation', (e) => {
      this.logViolation('csp_violation', {
        violatedDirective: e.violatedDirective,
        blockedURI: e.blockedURI,
        documentURI: e.documentURI
      });
    });

    // Monitor for page visibility changes (potential tab nabbing)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.logViolation('page_hidden', { timestamp: Date.now() });
      }
    });

    // Monitor for suspicious form submissions
    document.addEventListener('submit', (e) => {
      const form = e.target as HTMLFormElement;
      if (form.action && !form.action.startsWith(window.location.origin)) {
        this.logViolation('external_form_submission', { 
          action: form.action 
        });
      }
    });
  }

  // Get security violations for debugging
  getViolations() {
    return this.violations;
  }

  // Clear violations
  clearViolations() {
    this.violations = [];
  }
}

// Initialize security monitor
export const securityMonitor = SecurityMonitor.getInstance();
