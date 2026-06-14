import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-lg w-full bg-card border border-border rounded-xl p-6 shadow-lg space-y-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-destructive" />
            <h1 className="text-xl font-serif">Ocorreu um erro inesperado</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            A página encontrou um problema, mas o sistema continua funcionando.
            Tente novamente, recarregue ou volte ao início.
          </p>
          <pre className="text-xs bg-muted/60 rounded p-3 max-h-40 overflow-auto whitespace-pre-wrap break-words">
            {this.state.error.message}
          </pre>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={this.reset}>Tentar novamente</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>Recarregar</Button>
            <Button variant="ghost" onClick={() => { window.location.href = '/'; }}>Ir para o início</Button>
          </div>
        </div>
      </div>
    );
  }
}
