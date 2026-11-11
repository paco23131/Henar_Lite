# HENAR Lite

Instrumento musical sencillo, personalizable y replicable para niños con discapacidad.

El dispositivo (pads con sensor táctil y LED) se conecta como un teclado USB o Bluetooth normal. Una app instalable (PWA) recibe las teclas y reproduce los sonidos, y desde ella se configura qué suena en cada pad.

## Estado

Fase 0: bases del proyecto. La app es una página en blanco instalable, sin funcionalidad todavía.

## Estructura

```
app/     PWA (lo que se publica en GitHub Pages)
docs/    Decisiones de arquitectura y documentación
```

## Probar la app en local

Hace falta servirla por HTTP (el service worker no funciona abriendo el archivo directamente):

```
cd app
python3 -m http.server 8000
```

Y abrir http://localhost:8000

## Publicar en GitHub Pages (gratis)

1. Sube el repo a GitHub.
2. En el repositorio: Settings → Pages → Source: **GitHub Actions**.
3. Cada cambio en `app/` que llegue a `main` se publica solo en `https://<usuario>.github.io/<repo>/`.

Quien quiera su propia copia solo tiene que hacer un fork y repetir el paso 2.

## Licencia

Pendiente de decidir (ver `docs/decisiones.md`).
