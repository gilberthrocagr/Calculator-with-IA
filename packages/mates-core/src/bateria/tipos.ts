/** Areas del temario que cubre la fase 1 (niveles 1 y 2 del motor). */
export type Area =
  | 'aritmetica'
  | 'fracciones'
  | 'terminos-semejantes'
  | 'distributiva'
  | 'productos-notables'
  | 'factorizacion'
  | 'ecuaciones-lineales'
  | 'cuadraticas'
  | 'exponentes'
  | 'radicales'
  | 'logaritmos'
  | 'trigonometria';

export interface CasoBateria {
  id: string;
  area: Area;
  /** Estado antes del paso. */
  antes: string;
  /** Lo que escribio el alumno. */
  despues: string;
  /** Lo que el verificador TIENE que responder. */
  espera: 'EQUIVALENTE' | 'NO_EQUIVALENTE';
  /** Que error representa, cuando es un paso malo. Sirve de documentacion viva. */
  nota?: string;
}
