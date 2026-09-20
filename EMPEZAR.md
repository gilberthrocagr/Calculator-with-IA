# Como poner esto en un repo propio

Este codigo no tiene ninguna relacion con Deliservy: ni nombres, ni colores de
marca, ni dependencias. Es un proyecto independiente.

## 1. Crea el repo vacio

En GitHub, **con tu cuenta personal, no con la organizacion de Deliservy**.
Privado. Sin README, sin .gitignore, sin licencia (ya vienen aqui).

## 2. Sube esto

```bash
tar xzf paso-a-paso.tar.gz
cd paso-a-paso

git init
git add .
git commit -m "Verificador de pasos al 100% y fase 0 probada"
git branch -M main
git remote add origin git@github.com:TU-USUARIO/paso-a-paso.git
git push -u origin main
```

## 3. Comprueba que corre

```bash
npm install
cd packages/mates-core
npm test
```

Tiene que salir: 271 casos, 100% de deteccion (115/115), 100% de aceptacion
(156/156), 34 tests en verde.

## Lo unico que queda por decidir

- **El nombre.** Ahora es `paso-a-paso`. Si lo cambias, toca tres sitios:
  `package.json`, `packages/mates-core/package.json` y el comentario de
  `packages/mates-core/src/index.ts`.
- **El bundle id de la app.** Ahora es `com.pasoapaso.bancoriesgo` en
  `apps/banco-riesgo/app.json`. Ponle el dominio que vayas a usar de verdad
  antes de publicar nada en las tiendas.

Lo demas esta explicado en `README.md` y en `docs/fase-0-pruebas-de-riesgo.md`.
