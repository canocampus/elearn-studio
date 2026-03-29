# Issues — T610: Moodle SCORM Integration Test Suite

**Fecha:** 2026-03-28
**Revisión:** E2E QA — Moodle SCORM end-to-end validation
**Archivos creados/analizados:**
- `e2e/tests/moodle-scorm.spec.ts` (nuevo — 2 tests)
- `docker/docker-compose.dev.yml` — perfil `moodle`
- `e2e/pages/EditorPage.ts`

---

## Resumen ejecutivo

Se creó e integró el test de validación SCORM end-to-end más completo de la suite:
`moodle-scorm.spec.ts`. Cubre el flujo completo desde la creación del curso en
eLearn Studio hasta la verificación visual dentro del player SCORM de Moodle,
incluyendo todos los tipos de widget relevantes (texto, imagen, pregunta MC).

Los 2 tests permanecían marcados como **skipped** porque la condición de activación
(`E2E_MOODLE=1` o `MOODLE_URL`) no estaba presente en la ejecución estándar de CI.
Al ejecutarlos manualmente se detectó un problema de credenciales Moodle (contraseña
en la base de datos no coincidía con la del compose) que se resolvió via CLI.

**Tests añadidos:** 2
**Estado final:** 2/2 pasando ✅

---

## Issues

### BUG-T610-01 — Contraseña de admin Moodle no coincide con la configurada en Docker Compose (HIGH — FIXED)

**Entorno:** Docker Compose perfil `moodle` (`bitnamilegacy/moodle`)

**Severidad:** HIGH (bloqueo total de la suite Moodle)
**Estado:** FIXED

**Descripción:**

El test Step 2 fallaba con "Invalid login, please try again" al intentar autenticarse
en Moodle con `admin` / `Admin1234!`. La variable de entorno en `docker-compose.dev.yml`:

```yaml
- MOODLE_PASSWORD=${MOODLE_ADMIN_PASSWORD:-Admin1234!}
```

sólo tiene efecto en la **primera inicialización** de la base de datos. Si el
contenedor fue iniciado previamente (con datos persistidos en el volumen
`moodle_data`) con una contraseña distinta, la variable de entorno se ignora en
arranques posteriores.

**Diagnóstico:**

Se verificó que el login fallaba incluso con curl (token CSRF incluido), descartando
un problema de Playwright. La comprobación directa en la base de datos MariaDB
confirmó que el hash almacenado no correspondía a `Admin1234!`:

```bash
docker exec docker-moodle-db-1 mariadb -u moodle -pmoodle_pass moodle \
  -e "SELECT username, password FROM mdl_user WHERE username='admin';"
```

**Fix aplicado:**

Resetear la contraseña a través del CLI de Moodle (que actualiza directamente la
base de datos y respeta la política de contraseñas del sitio):

```bash
docker exec docker-moodle-1 bash -c \
  "php /opt/bitnami/moodle/admin/cli/reset_password.php \
   --username=admin --password='Admin1234!'"
# → Password changed
```

**Nota de política de contraseñas:**
Moodle rechaza contraseñas sin carácter especial (`Admin1234` → error). El `!`
satisface el requisito. Si se necesita cambiar la contraseña de nuevo, el CLI
valida la política antes de actualizar.

**Prevención futura:**

Para entornos CI que arrancan Moodle desde cero con un volumen limpio, el compose
con `MOODLE_PASSWORD=Admin1234!` funciona correctamente en el primer arranque.
En entornos con volúmenes persistidos de versiones anteriores, ejecutar el reset
CLI antes de correr la suite.

---

### GAP-T610-01 — No existía test E2E de integración SCORM completa con Moodle (HIGH — CLOSED)

**Archivo:** `e2e/tests/moodle-scorm.spec.ts`
**Severidad:** HIGH (flujo crítico sin cobertura)
**Estado:** CLOSED — 2 tests añadidos, ambos pasando

**Descripción:**

El flujo más crítico del producto — exportar un curso como SCORM e importarlo en
un LMS real — no tenía ninguna cobertura E2E. `scorm-export.spec.ts` sólo
verificaba que el ZIP se descargaba y tenía un nombre correcto; no validaba el
contenido del ZIP ni si el LMS podía reproducirlo.

**Impacto del gap:** Un bug en el runtime player, en el packager, o en la
generación del `imsmanifest.xml` podía pasar desapercibido hasta que un
instructor real importase el curso en su LMS.

---

## Descripción de los tests añadidos

### Step 1 — build 3-slide course and download SCORM ZIP

**Tipo:** API (sin browser) — usa `request` fixture de Playwright
**Timeout:** 60s

Flujo:
1. Autentica con el API de eLearn Studio (`POST /auth/login`).
2. Crea un curso nuevo (`POST /courses`).
3. Escribe 3 slides via `PUT /courses/:id` con la estructura completa de widgets:
   - **Slide 1** — widget `text` con HTML + widget `nav-buttons`
   - **Slide 2** — widget `text` + widget `image` (SVG inline) + widget `nav-buttons`
   - **Slide 3** — widget `question-mc` con 4 opciones, respuesta correcta `Paris`
4. Llama a `POST /courses/:id/export/scorm12`.
5. Guarda el ZIP en un directorio temporal de sistema operativo.

Assertiones:
- `exportRes.ok()` (status 2xx)
- `content-type` incluye `zip` u `octet-stream`
- El archivo ZIP existe en disco
- El ZIP tiene más de 1000 bytes (no está vacío)

El `zipPath` se expone como variable compartida para que Step 2 lo consuma.

---

### Step 2 — upload to Moodle and verify slides render

**Tipo:** Browser — usa `browser` fixture de Playwright (contexto nuevo sin storageState)
**Timeout:** 180s

Flujo completo via Playwright con navegador real:

1. **Login a Moodle** — `pressSequentially` en lugar de `fill` para evitar que el
   script `core_form/submit` de Moodle 5.x limpie el campo password (ese script
   detecta asignación directa de `value` y resetea el campo).

2. **Crear un curso en Moodle** — navega a `course/edit.php?category=1`, completa
   nombre/shortname, guarda.

3. **Dismiss UI tour** — Moodle muestra un tour guiado en el primer acceso a un
   curso; se cierra con `button[data-action="end-tour"]` si aparece.

4. **Habilitar modo edición** — detecta tanto el checkbox de Moodle 5.x
   (`.editmode-switch-form input[type="checkbox"]`) como el botón de Moodle 4.x
   (`[data-key="editmode"]`).

5. **Añadir actividad SCORM** — navega directamente a
   `modedit.php?add=scorm&course=<id>` (bypasa el activity chooser que cambió
   entre versiones de Moodle).

6. **Subir el ZIP** — usa el file picker nativo de Moodle:
   - Clic en `.fp-btn-add a[role="button"]`
   - Selecciona la tab "Upload a file" (`.fp-repo[title*="Upload"]`)
   - `setInputFiles(zipPath)` en `input[name="repo_upload_file"]`
   - Clic en "Upload this file"

7. **Guardar la actividad** — `#id_submitbutton`.

8. **Lanzar el player SCORM** — Moodle abre el player en una ventana popup;
   se captura con `context.waitForEvent('page')`.

9. **Verificar slide por slide dentro del iframe `scorm_object`:**

| Slide | Assertión |
|-------|-----------|
| Slide 1 | `.el-widget.el-text` visible + contiene "Welcome to eLearn Studio" |
| Slide 2 | `.el-widget.el-image img` visible + `src` no vacío |
| Slide 3 | `.el-widget.el-question-mc` visible + contiene "What is the capital of France?" + exactamente 4 `input[type="radio"]` visibles |

La navegación entre slides usa `[data-action="next"]` dentro del iframe SCORM.

---

## Notas de compatibilidad Moodle

El test es compatible con **Moodle 4.x y 5.x** gracias a:

| Elemento | Moodle 4.x | Moodle 5.x | Solución |
|----------|-----------|-----------|---------|
| Toggle edición | `[data-key="editmode"]` button | `.editmode-switch-form input[type="checkbox"]` | Detección con fallback |
| Añadir actividad | Activity chooser modal | Activity chooser renovado | Navegación directa a `modedit.php` |
| UI tour | Puede aparecer | Puede aparecer | `catch()` en `.isVisible()` |

---

## Activación de los tests

Los tests están **opt-in por defecto** para no requerir Moodle en CI estándar:

```bash
# Requiere: docker compose --profile moodle up -d
E2E_MOODLE=1 npx playwright test tests/moodle-scorm.spec.ts

# O con URL personalizada:
MOODLE_URL=http://mi-moodle:8081 npx playwright test tests/moodle-scorm.spec.ts

# Credenciales personalizadas (opcional):
MOODLE_ADMIN_USER=admin MOODLE_ADMIN_PASSWORD=Admin1234! \
  E2E_MOODLE=1 npx playwright test tests/moodle-scorm.spec.ts
```

La condición de skip:
```typescript
const MOODLE_ENABLED = !!(process.env.MOODLE_URL ?? process.env.E2E_MOODLE)
test.beforeEach(() => {
  test.skip(!MOODLE_ENABLED, 'Set MOODLE_URL or E2E_MOODLE=1 to run Moodle integration tests')
})
```

---

## Archivos creados/modificados

| Archivo | Cambio |
|---------|--------|
| `e2e/tests/moodle-scorm.spec.ts` | Nuevo — 2 tests (421 líneas) |

---

## Resumen

| Severidad | Bugs activos | Gaps de cobertura |
|-----------|-------------|-------------------|
| HIGH      | 1 (FIXED)   | 1 (CLOSED)        |
| MEDIUM    | —           | —                 |
| LOW       | —           | —                 |

**Suite Moodle:** 2/2 tests pasando ✅
**Tiempo de ejecución:** ~32s (Step 1: 25s API, Step 2: 7s browser)
