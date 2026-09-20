import type { CasoBateria } from './tipos.js';

/**
 * Precalculo. Aqui la capa 2 (rationalize) ya no llega — lanza "unsolved
 * function call" — y quien decide es el muestreo de la capa 3.
 * En mathjs log() es logaritmo NATURAL; el decimal es log10().
 */
export const EXPONENTES: CasoBateria[] = [
  { id: 'ex-01', area: 'exponentes', antes: 'x^2*x^3', despues: 'x^5', espera: 'EQUIVALENTE' },
  { id: 'ex-02', area: 'exponentes', antes: 'x^2*x^3', despues: 'x^6', espera: 'NO_EQUIVALENTE', nota: 'multiplica los exponentes al multiplicar potencias' },
  { id: 'ex-03', area: 'exponentes', antes: '(x^2)^3', despues: 'x^6', espera: 'EQUIVALENTE' },
  { id: 'ex-04', area: 'exponentes', antes: '(x^2)^3', despues: 'x^5', espera: 'NO_EQUIVALENTE', nota: 'suma los exponentes en una potencia de potencia' },
  { id: 'ex-05', area: 'exponentes', antes: 'x^5/x^2', despues: 'x^3', espera: 'EQUIVALENTE' },
  { id: 'ex-06', area: 'exponentes', antes: 'x^5/x^2', despues: 'x^2.5', espera: 'NO_EQUIVALENTE', nota: 'divide los exponentes' },
  { id: 'ex-07', area: 'exponentes', antes: '(2*x)^3', despues: '8*x^3', espera: 'EQUIVALENTE' },
  { id: 'ex-08', area: 'exponentes', antes: '(2*x)^3', despues: '2*x^3', espera: 'NO_EQUIVALENTE', nota: 'no eleva el coeficiente' },
  { id: 'ex-09', area: 'exponentes', antes: '(x*y)^2', despues: 'x^2*y^2', espera: 'EQUIVALENTE' },
  { id: 'ex-10', area: 'exponentes', antes: '(x/y)^3', despues: 'x^3/y^3', espera: 'EQUIVALENTE' },
  { id: 'ex-11', area: 'exponentes', antes: 'x^(-2)', despues: '1/x^2', espera: 'EQUIVALENTE' },
  { id: 'ex-12', area: 'exponentes', antes: 'x^(-2)', despues: '-x^2', espera: 'NO_EQUIVALENTE', nota: 'el exponente negativo invierte, no cambia el signo' },
  { id: 'ex-13', area: 'exponentes', antes: 'x^(1/2)', despues: 'sqrt(x)', espera: 'EQUIVALENTE' },
  { id: 'ex-14', area: 'exponentes', antes: 'x^(1/3)', despues: 'x/3', espera: 'NO_EQUIVALENTE', nota: 'confunde exponente fraccionario con division' },
  { id: 'ex-15', area: 'exponentes', antes: '2^x*2^y', despues: '2^(x+y)', espera: 'EQUIVALENTE' },
  { id: 'ex-16', area: 'exponentes', antes: '2^x*2^y', despues: '2^(x*y)', espera: 'NO_EQUIVALENTE', nota: 'multiplica los exponentes' },
  { id: 'ex-17', area: 'exponentes', antes: '2^x*3^x', despues: '6^x', espera: 'EQUIVALENTE' },
  { id: 'ex-18', area: 'exponentes', antes: '2^x+2^x', despues: '2^(x+1)', espera: 'EQUIVALENTE' },
  { id: 'ex-19', area: 'exponentes', antes: '2^x+2^x', despues: '4^x', espera: 'NO_EQUIVALENTE', nota: 'sumar potencias no es multiplicar bases' },
  { id: 'ex-20', area: 'exponentes', antes: 'x^3*y^2/(x*y)', despues: 'x^2*y', espera: 'EQUIVALENTE' },
];

export const RADICALES: CasoBateria[] = [
  { id: 'ra-01', area: 'radicales', antes: 'sqrt(x)*sqrt(x)', despues: 'x', espera: 'EQUIVALENTE' },
  { id: 'ra-02', area: 'radicales', antes: 'sqrt(x*y)', despues: 'sqrt(x)*sqrt(y)', espera: 'EQUIVALENTE' },
  { id: 'ra-03', area: 'radicales', antes: 'sqrt(x+y)', despues: 'sqrt(x)+sqrt(y)', espera: 'NO_EQUIVALENTE', nota: 'la raiz no se reparte sobre la suma' },
  { id: 'ra-04', area: 'radicales', antes: 'sqrt(4*x^2)', despues: '2*x', espera: 'EQUIVALENTE', nota: 'valido en el dominio positivo que usa la capa 3' },
  { id: 'ra-05', area: 'radicales', antes: 'sqrt(x^2+y^2)', despues: 'x+y', espera: 'NO_EQUIVALENTE', nota: 'el error de Pitagoras mal aplicado' },
  { id: 'ra-06', area: 'radicales', antes: 'sqrt(8)', despues: '2*sqrt(2)', espera: 'EQUIVALENTE' },
  { id: 'ra-07', area: 'radicales', antes: 'sqrt(8)', despues: '4*sqrt(2)', espera: 'NO_EQUIVALENTE', nota: 'saca el 4 entero en vez de su raiz' },
  { id: 'ra-08', area: 'radicales', antes: 'sqrt(18)', despues: '3*sqrt(2)', espera: 'EQUIVALENTE' },
  { id: 'ra-09', area: 'radicales', antes: '1/sqrt(x)', despues: 'sqrt(x)/x', espera: 'EQUIVALENTE', nota: 'racionalizar el denominador' },
  { id: 'ra-10', area: 'radicales', antes: 'sqrt(x)/sqrt(y)', despues: 'sqrt(x/y)', espera: 'EQUIVALENTE' },
  { id: 'ra-11', area: 'radicales', antes: '(sqrt(x))^2', despues: 'x', espera: 'EQUIVALENTE' },
  { id: 'ra-12', area: 'radicales', antes: 'sqrt(x)^3', despues: 'x^(3/2)', espera: 'EQUIVALENTE' },
  { id: 'ra-13', area: 'radicales', antes: '8^(1/3)', despues: '2', espera: 'EQUIVALENTE' },
  { id: 'ra-14', area: 'radicales', antes: '8^(1/3)', despues: '8/3', espera: 'NO_EQUIVALENTE', nota: 'divide la base entre el indice' },
  { id: 'ra-15', area: 'radicales', antes: 'sqrt(x)+sqrt(x)', despues: '2*sqrt(x)', espera: 'EQUIVALENTE' },
  { id: 'ra-16', area: 'radicales', antes: 'sqrt(x)+sqrt(x)', despues: 'sqrt(2*x)', espera: 'NO_EQUIVALENTE', nota: 'mete el coeficiente dentro sin elevarlo' },
  { id: 'ra-17', area: 'radicales', antes: '2*sqrt(x)', despues: 'sqrt(4*x)', espera: 'EQUIVALENTE', nota: 'meterlo dentro SI eleva el coeficiente' },
  { id: 'ra-18', area: 'radicales', antes: 'sqrt(50)-sqrt(2)', despues: '4*sqrt(2)', espera: 'EQUIVALENTE' },
  { id: 'ra-19', area: 'radicales', antes: 'sqrt(50)-sqrt(2)', despues: 'sqrt(48)', espera: 'NO_EQUIVALENTE', nota: 'resta dentro de la raiz' },
  { id: 'ra-20', area: 'radicales', antes: '1/(sqrt(x)+1)', despues: '(sqrt(x)-1)/(x-1)', espera: 'EQUIVALENTE', nota: 'conjugado' },
];

export const LOGARITMOS: CasoBateria[] = [
  { id: 'lo-01', area: 'logaritmos', antes: 'log(x*y)', despues: 'log(x)+log(y)', espera: 'EQUIVALENTE' },
  { id: 'lo-02', area: 'logaritmos', antes: 'log(x+y)', despues: 'log(x)+log(y)', espera: 'NO_EQUIVALENTE', nota: 'el logaritmo de la suma no es la suma de logaritmos' },
  { id: 'lo-03', area: 'logaritmos', antes: 'log(x/y)', despues: 'log(x)-log(y)', espera: 'EQUIVALENTE' },
  { id: 'lo-04', area: 'logaritmos', antes: 'log(x/y)', despues: 'log(x)/log(y)', espera: 'NO_EQUIVALENTE', nota: 'confunde cociente con division de logaritmos' },
  { id: 'lo-05', area: 'logaritmos', antes: 'log(x^2)', despues: '2*log(x)', espera: 'EQUIVALENTE' },
  { id: 'lo-06', area: 'logaritmos', antes: 'log(x^2)', despues: 'log(x)^2', espera: 'NO_EQUIVALENTE', nota: 'el exponente sale multiplicando, no eleva el logaritmo' },
  { id: 'lo-07', area: 'logaritmos', antes: 'log(1)', despues: '0', espera: 'EQUIVALENTE' },
  { id: 'lo-08', area: 'logaritmos', antes: 'log(exp(x))', despues: 'x', espera: 'EQUIVALENTE' },
  { id: 'lo-09', area: 'logaritmos', antes: 'exp(log(x))', despues: 'x', espera: 'EQUIVALENTE' },
  { id: 'lo-10', area: 'logaritmos', antes: 'log10(100)', despues: '2', espera: 'EQUIVALENTE' },
  { id: 'lo-11', area: 'logaritmos', antes: 'log10(100)', despues: '10', espera: 'NO_EQUIVALENTE', nota: 'confunde el logaritmo con la raiz' },
  { id: 'lo-12', area: 'logaritmos', antes: 'exp(a+b)', despues: 'exp(a)*exp(b)', espera: 'EQUIVALENTE' },
  { id: 'lo-13', area: 'logaritmos', antes: 'exp(a+b)', despues: 'exp(a)+exp(b)', espera: 'NO_EQUIVALENTE', nota: 'reparte la exponencial sobre la suma' },
  { id: 'lo-14', area: 'logaritmos', antes: 'log(x)+log(y)-log(z)', despues: 'log(x*y/z)', espera: 'EQUIVALENTE' },
  { id: 'lo-15', area: 'logaritmos', antes: '3*log(x)', despues: 'log(x^3)', espera: 'EQUIVALENTE' },
  { id: 'lo-16', area: 'logaritmos', antes: '3*log(x)', despues: 'log(3*x)', espera: 'NO_EQUIVALENTE', nota: 'mete el coeficiente multiplicando en vez de como exponente' },
];

export const TRIGONOMETRIA: CasoBateria[] = [
  { id: 'tr-01', area: 'trigonometria', antes: 'sin(x)^2+cos(x)^2', despues: '1', espera: 'EQUIVALENTE', nota: 'aqui symbolicEqual devuelve false' },
  { id: 'tr-02', area: 'trigonometria', antes: 'sin(2*x)', despues: '2*sin(x)*cos(x)', espera: 'EQUIVALENTE' },
  { id: 'tr-03', area: 'trigonometria', antes: 'sin(2*x)', despues: '2*sin(x)', espera: 'NO_EQUIVALENTE', nota: 'saca el 2 del argumento' },
  { id: 'tr-04', area: 'trigonometria', antes: 'cos(2*x)', despues: 'cos(x)^2-sin(x)^2', espera: 'EQUIVALENTE' },
  { id: 'tr-05', area: 'trigonometria', antes: 'cos(2*x)', despues: '2*cos(x)', espera: 'NO_EQUIVALENTE', nota: 'mismo error con el coseno' },
  { id: 'tr-06', area: 'trigonometria', antes: 'tan(x)', despues: 'sin(x)/cos(x)', espera: 'EQUIVALENTE' },
  { id: 'tr-07', area: 'trigonometria', antes: 'tan(x)', despues: 'cos(x)/sin(x)', espera: 'NO_EQUIVALENTE', nota: 'invierte la razon' },
  { id: 'tr-08', area: 'trigonometria', antes: 'sin(x+y)', despues: 'sin(x)*cos(y)+cos(x)*sin(y)', espera: 'EQUIVALENTE' },
  { id: 'tr-09', area: 'trigonometria', antes: 'sin(x+y)', despues: 'sin(x)+sin(y)', espera: 'NO_EQUIVALENTE', nota: 'el seno no es lineal' },
  { id: 'tr-10', area: 'trigonometria', antes: 'cos(x+y)', despues: 'cos(x)*cos(y)-sin(x)*sin(y)', espera: 'EQUIVALENTE' },
  { id: 'tr-11', area: 'trigonometria', antes: 'cos(x+y)', despues: 'cos(x)*cos(y)+sin(x)*sin(y)', espera: 'NO_EQUIVALENTE', nota: 'signo de la formula de adicion' },
  { id: 'tr-12', area: 'trigonometria', antes: '1+tan(x)^2', despues: '1/cos(x)^2', espera: 'EQUIVALENTE' },
  { id: 'tr-13', area: 'trigonometria', antes: 'sin(-x)', despues: '-sin(x)', espera: 'EQUIVALENTE' },
  { id: 'tr-14', area: 'trigonometria', antes: 'cos(-x)', despues: 'cos(x)', espera: 'EQUIVALENTE' },
  { id: 'tr-15', area: 'trigonometria', antes: 'cos(-x)', despues: '-cos(x)', espera: 'NO_EQUIVALENTE', nota: 'el coseno es par, no impar' },
  { id: 'tr-16', area: 'trigonometria', antes: 'cos(x)^2', despues: '(1+cos(2*x))/2', espera: 'EQUIVALENTE' },
  { id: 'tr-17', area: 'trigonometria', antes: 'sin(x)^2', despues: '(1-cos(2*x))/2', espera: 'EQUIVALENTE' },
  { id: 'tr-18', area: 'trigonometria', antes: 'sin(x)^2', despues: '(1+cos(2*x))/2', espera: 'NO_EQUIVALENTE', nota: 'intercambia las formulas de reduccion' },
];
