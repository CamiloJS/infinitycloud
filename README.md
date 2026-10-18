# Infinity ☁️✨

> **Repositorio personal multi-plataforma que organiza y reproduce archivos alojados en Notion, YouTube, Google Drive, SoundCloud, Vimeo y enlaces directos.**

Infinity reúne contenido distribuido en diversas fuentes sin almacenar los archivos originales en nuestro servidor. Navega por tus archivos con la fluidez y elegancia de un explorador moderno, visualiza fotos, reproduce videos y música en segundo plano, e inspecciona documentos de forma segura dentro de una única aplicación web.

---

## 🚀 Características Principales

### 1. Explorador Visual Inteligente
- **Detección automática de proveedores y categorías:** Pega una URL y la app identifica automáticamente el servicio (YouTube, Drive, Notion, SoundCloud, Vimeo, enlaces directos a imágenes, audio, video y documentos).
- **Tarjetas y miniaturas reales:** Visualización cuidada con badges de plataforma y tipo de archivo, sin inventar tamaños ni duraciones.
- **Colecciones / Carpetas seguras:** Crea, renombra y organiza colecciones. Al eliminar una colección, los archivos se preservan de forma segura (se mueven a la raíz sin perderse).
- **Favoritos y Papelera:** Marca favoritos con un clic; papelera completa con opción de restaurar o eliminar definitivamente.
- **Vistas y filtros:** Alterna entre vista de cuadrícula (Grid) y lista compacta (List). Búsqueda en tiempo real por nombre, URL o proveedor, y ordenamiento por fecha o nombre.
- **Copia de seguridad en JSON:** Exporta e importa metadatos con validación estricta (esquemas Zod) en modo combinación (merge) o reemplazo total.

### 2. Visores y Reproductores Integrados
- 🖼️ **Fotos:** Visor lightbox a pantalla completa con zoom in/out, controles de escala, atajos de teclado (`ArrowLeft`, `ArrowRight`, `Esc`) y descarga directa.
- 🎬 **Videos:** Reproducción fluida nativa para videos directos (MP4, WebM) y reproductores oficiales integrados para YouTube (mediante `youtube-nocookie.com`, compatible con videos no listados) y Vimeo. Si una plataforma restringe la inserción, se explica claramente el motivo y se ofrece un enlace directo al original.
- 🎵 **Música persistente:** Reproductor de audio fijado en la parte inferior de la pantalla que **continúa reproduciéndose sin interrupciones mientras navegas por la aplicación**. Incluye barra de progreso interactiva, control de volumen con silencio, modos de repetición (desactivado, todo, una pista), aleatorio y gestión de cola de reproducción. Compatible con pistas directas y widget oficial de SoundCloud.
- 📄 **Documentos:** Visor de PDF integrado; lector seguro para archivos de Texto, Markdown, JSON (con formato e indentación) y tablas interactivas para CSV. Vista previa externa para documentos Office (Word, Excel, PowerPoint) con clara distinción del archivo original y descarga directa, **sin ejecutar jamás scripts o código HTML de terceros (protección total contra XSS)**.
- 📦 **Otros archivos:** Ficha de metadatos detallada con tipo MIME, fecha y enlace original.

### 3. Integración con Notion (Alta Prioridad y Seguridad)
- **Acceso mediante Notion API oficial:** Conecta tu integración interna sin exponer credenciales.
- **Cifrado en reposo:** Los tokens de integración de Notion se cifran en el servidor con **AES-256-GCM** y nunca se envían al navegador ni se guardan en texto plano.
- **Búsqueda de páginas y bases de datos compartidas:** Localiza fácilmente los recursos autorizados en tu espacio de trabajo.
- **Escaneo exhaustivo y recursivo:** Descubre imágenes, videos, audio, PDF y archivos adjuntos en bloques (incluyendo bloques anidados) y propiedades de bases de datos.
- **Prevención de duplicados:** Identificación única por ID de bloque/página para permitir reintentos sin duplicar elementos.
- **Renovación dinámica de URLs firmadas:** Las URLs temporales de Notion S3 que expiran tras 1 hora son resueltas dinámicamente en el servidor en tiempo real.
- **Proxy multimedia con protección SSRF:** Valida dominios permitidos de AWS S3 Notion y soporta cabeceras de rango (`Range: bytes`) para permitir rebobinado y avance rápido de audio y video.

### 4. Cuentas y Seguridad
- **Autenticación con Google y Correo:** Firebase Authentication con sesiones verificadas.
- **Aislamiento estricto de datos:** Espacios de almacenamiento independientes por usuario (`/users/{userId}/...`), protegidos por reglas de seguridad de Firestore.
- **Verificación en dos pasos (2FA / TOTP):** Compatible con Google Authenticator, Authy, 1Password, etc. Incluye código QR, clave secreta manual y **8 códigos de recuperación de un solo uso** (con protección contra reutilización) para no perder el acceso en caso de extraviar el celular.
- **Entorno de prueba integrado:** Botones de alternancia entre Cuenta 1 y Cuenta 2 para comprobar y auditar de inmediato la separación de datos y el flujo 2FA sin requerir claves de nube previas.

### 5. Diseño y Temas
- **Identidad visual:** Logotipo e icono SVG combinando la nube y el símbolo de infinito con degradado cian (`#06b6d4`), azul (`#3b82f6`) y violeta (`#8b5cf6`).
- **Modos de color:** Sistema (por defecto), Claro (fondo blanco puro) y Oscuro (fondo grafito/negro mate, sin fotos de paisajes como fondo).
- **Cero destellos de tema (No-FOUC):** Script síncrono en cabecera para aplicar inmediatamente la preferencia guardada en `localStorage`.
- **Adaptabilidad completa:** Totalmente optimizado para computadores de escritorio y celulares, sin desbordamiento horizontal y con controles táctiles cómodos.

---

## 🛠️ Tecnologías

- **Framework:** [Next.js](https://nextjs.org/) 16 (App Router, Turbopack)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
- **Estilos:** [Tailwind CSS](https://tailwindcss.com/) v4
- **Iconos:** [Lucide React](https://lucide.dev/)
- **Autenticación y BD:** [Firebase Authentication](https://firebase.google.com/products/auth) & [Cloud Firestore](https://firebase.google.com/products/firestore)
- **Seguridad y 2FA:** [otplib](https://github.com/yeojinj/otplib), [qrcode](https://github.com/soldair/node-qrcode), criptografía nativa de Node.js (AES-256-GCM)
- **Validación:** [Zod](https://zod.dev/)
- **Pruebas:** [Vitest](https://vitest.dev/) (37 pruebas automatizadas)
- **SDK Oficial:** `@notionhq/client`

---

## 📦 Instalación y Ejecución Local

### Prerrequisitos
- Node.js versión 20 o superior (recomendado v22 o v24).
- npm versión 10 o superior.

### Pasos

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/CamiloJS/infinitycloud.git
   cd infinitycloud
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env.local
   ```
   *(Si deseas probar de inmediato, la aplicación incluye un modo interactivo local completo que funciona incluso antes de configurar tus credenciales de Firebase en `.env.local`).*

4. **Ejecutar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

5. **Ejecutar las pruebas automatizadas:**
   ```bash
   npm run test
   ```

6. **Compilar para producción:**
   ```bash
   npm run build
   ```

---

## 🔐 Configuración de Servicios

### 1. Firebase (Opcional para nube en vivo)
Si deseas conectar un proyecto real de Google Firebase:
1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. En **Authentication**, habilita el proveedor **Google** y **Correo/Contraseña**.
3. En **Firestore Database**, crea la base de datos en modo producción y aplica las reglas contenidas en `firestore.rules`.
4. En Configuración del proyecto > General, añade una App Web y copia los valores a `NEXT_PUBLIC_FIREBASE_*` en tu `.env.local`.
5. En Configuración del proyecto > Cuentas de servicio, genera una clave privada y copia los valores a `FIREBASE_*` en tu `.env.local`.

### 2. Integración con Notion
Para conectar tu cuenta de Notion:
1. Entra a [notion.so/my-integrations](https://www.notion.so/my-integrations) y crea una nueva integración con el nombre "Infinity".
2. Copia el **Internal Integration Secret**.
3. En la interfaz de Infinity, pulsa el botón **Notion** en la barra lateral y pega tu clave.
4. En Notion, ve a cualquier página o base de datos que quieras importar, haz clic en el menú de tres puntos (**...**) situado en la esquina superior derecha, selecciona **Conexiones** (o *Add connections*) y agrega tu integración "Infinity".
5. ¡Listo! Pulsa "Escanear e importar archivos" en Infinity.

---

## 🧪 Pruebas Realizadas (Rondas 1 y 2)

El proyecto cuenta con una suite de pruebas automatizadas con Vitest ejecutadas en dos rondas:

| Módulo de Prueba | Descripción | Estado |
| :--- | :--- | :---: |
| **Adaptadores** (`adapters.test.ts`) | Extracción de IDs y URLs de YouTube (shorts, embeds, unlisted), Drive, Docs, Vimeo, SoundCloud, enlaces directos y detección genérica. | ✅ Aprobado (17 tests) |
| **Seguridad y SSRF** (`security.test.ts`) | Bloqueo de rangos de IP privadas (127.0.0.1, 10.x, 192.168.x, 169.254.169.254), validación de dominios seguros de Notion S3 y cifrado AES-256-GCM con detección de manipulación. | ✅ Aprobado (10 tests) |
| **Autenticación 2FA** (`totp.test.ts`) | Generación de secretos TOTP, códigos QR, verificación de tokens temporales y consumo no reutilizable de códigos de recuperación (quema de código). | ✅ Aprobado (3 tests) |
| **Validación de Datos** (`validation.test.ts`) | Validación de esquemas Zod para elementos, colecciones y archivos de copia de seguridad JSON. Rechazo de versiones incompatibles o URLs malformadas. | ✅ Aprobado (4 tests) |
| **Aislamiento de Cuentas** (`isolation.test.ts`) | Separación estricta de datos entre cuentas, eliminación segura de colecciones (preservando archivos intactos) y ciclo de vida de la papelera. | ✅ Aprobado (3 tests) |
| **Compilación de Producción** | Verificación con Turbopack y TypeScript (`npm run build`). | ✅ Aprobado (13 rutas) |

---

## 🌐 Despliegue en Vercel

El proyecto está 100% preparado para ser desplegado en Vercel (preferiblemente en **infinitycloud.vercel.app**).

### Pasos para desplegar:
1. Conectar el repositorio de GitHub `https://github.com/CamiloJS/infinitycloud.git` desde el panel de Vercel.
2. O bien mediante Vercel CLI:
   ```bash
   vercel login
   vercel --prod
   ```
3. Agregar las variables de entorno definidas en `.env.example` en el panel de Vercel (**Settings > Environment Variables**).

---

## 🧭 Guía para Continuar el Desarrollo

- **Añadir nuevos proveedores:** Crea una nueva clase en `src/lib/adapters/` implementando la interfaz `ProviderAdapter` de `types.ts`, y regístrala en la lista de `src/lib/adapters/registry.ts`.
- **Nuevos visores:** Los componentes modales de visor se encuentran aislados en `src/components/viewers/`. Para soportar un nuevo formato, implementa el visor y conéctalo en `HomePage.tsx`.
- **Reglas de seguridad:** Cualquier modificación a la estructura de colecciones debe reflejarse en `firestore.rules`.

---

© 2026 Infinity Cloud. Desarrollado con esmero y precisión técnica.
