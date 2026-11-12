// Red de contención: si una pantalla falla al dibujarse, no queda en blanco en
// medio de la demo. Dice qué pasó y se vuelve a montar sola.

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface Estado {
  error: Error | null;
  intentos: number;
}

const REINTENTO_MS = 2500;
const MAX_INTENTOS = 5;

export class Red extends Component<Props, Estado> {
  state: Estado = { error: null, intentos: 0 };
  private reloj: number | undefined;

  static getDerivedStateFromError(error: Error): Partial<Estado> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[offside] falló una pantalla", error, info.componentStack);
    window.clearTimeout(this.reloj);
    if (this.state.intentos < MAX_INTENTOS) {
      this.reloj = window.setTimeout(() => this.reintentar(), REINTENTO_MS);
    }
  }

  componentWillUnmount(): void {
    window.clearTimeout(this.reloj);
  }

  private reintentar = (): void => {
    this.setState((s) => ({ error: null, intentos: s.intentos + 1 }));
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="falla" role="alert">
        <h1>La pantalla falló al dibujarse</h1>
        <p>
          Las firmas y las órdenes no se pierden: están en el servidor.{" "}
          {this.state.intentos < MAX_INTENTOS ? "Se vuelve a intentar sola en unos segundos." : "Recargá la página para seguir."}
        </p>
        <p className="huella">{this.state.error.message}</p>
        <div className="falla-botones">
          <button type="button" className="boton boton-grafito boton-44" onClick={this.reintentar}>
            <span>Reintentar ahora</span>
          </button>
          <button type="button" className="boton boton-porcelana boton-44" onClick={() => window.location.reload()}>
            <span>Recargar la página</span>
          </button>
        </div>
      </main>
    );
  }
}
