# Decisiones de arquitectura

## Principio

Lo más simple posible, coste cero y replicable por la comunidad.

## Decidido

- **Dispositivo = teclado estándar (HID) por USB o Bluetooth.** Cada pad envía una tecla fija. No se usa MIDI ni serie: así funciona en Android, Windows, Mac, Linux e iOS sin drivers ni permisos especiales en el navegador.
- **El firmware no sabe de notas.** Solo lee pads, enciende el LED del pad pulsado y envía su tecla. Todo lo musical vive en la app.
- **App = PWA.** Una sola base de código para móvil, escritorio y web. Instalable y funciona sin conexión.
- **Hosting: GitHub Pages**, gratis, con HTTPS, sin servidor ni base de datos. La configuración se guarda en el propio dispositivo y se podrá exportar a archivo.
- **Sonidos con Web Audio**, dentro de la app.
- **Alcance de uso:** que suenen 1 o 2 teclas a la vez es suficiente. No se diseña para polifonía compleja.

## Abierto

- **Microcontrolador:** ESP32-S3 (USB + Bluetooth) frente a Raspberry Pi Pico (solo USB). Con ESP32-S3 el módulo Bluetooth del presupuesto desaparece.
- **Número de pines:** 24-33 pads necesitan expansores de E/S (por ejemplo MCP23017) o registros de desplazamiento.
- **Licencia** (código y documentación). Condiciona qué librerías y soundfonts se pueden reutilizar.
- **Fuente de sonidos:** samples o soundfonts con licencia compatible.

## Pendiente de verificar con hardware

- Comportamiento de teclado Bluetooth en Android (emparejado e interferencias con el teclado en pantalla).
- Número de teclas simultáneas que admite el descriptor HID elegido.
