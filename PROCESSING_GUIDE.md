# Letterboxd Data Processor

Script Python para procesar exportaciones de Letterboxd y generar un JSON incremental con información de películas incluyendo pósters.

## Características

- 📦 Procesa múltiples exportaciones ZIP de Letterboxd
- 🎬 Extrae datos de películas vistas, calificaciones, reseñas, watchlist y likes
- 🖼️ Obtiene imágenes de pósters (opcional)
- 📈 Genera JSON incremental que se actualiza con nuevos usuarios
- 🔄 Mantiene datos existentes al procesar nuevos usuarios

## Requisitos

```bash
pip install feedparser requests
```

## Uso

### 1. Procesar un único ZIP

```bash
python process_letterboxd.py --zip path/to/export.zip
```

Opcionalmente especificar un nombre de usuario personalizado:

```bash
python process_letterboxd.py --zip path/to/export.zip --user "mi-usuario"
```

### 2. Procesar múltiples ZIPs de un directorio

```bash
python process_letterboxd.py --batch path/to/directory
```

### 3. Procesar y obtener pósters

```bash
python process_letterboxd.py --zip path/to/export.zip --fetch-posters
```

### 4. Especificar archivo de salida personalizado

```bash
python process_letterboxd.py --zip path/to/export.zip --output data/movies.json
```

## Estructura del JSON Generado

```json
{
  "users": [
    {
      "name": "usuario1",
      "watched": [...],
      "ratings": [...],
      "reviews": [...],
      "watchlist": [...],
      "likes": [...],
      "enabled": true,
      "updatedAt": "2026-02-10T12:00:00"
    }
  ],
  "movies": {
    "Película|2024": {
      "name": "Película",
      "year": "2024",
      "uri": "https://letterboxd.com/film/...",
      "poster": "https://a.ltrbxd.com/...",
      "users": [
        {
          "name": "usuario1",
          "rating": "8.0",
          "watched": true
        }
      ]
    }
  },
  "lastUpdated": "2026-02-10T12:00:00"
}
```

## Integración con la Aplicación Web

1. **Generar datos iniciales:**
   ```bash
   python process_letterboxd.py --zip usuario1.zip --fetch-posters
   ```

2. **Copiar `data.json` a la carpeta `web/`:**
   ```bash
   cp data.json web/
   ```

3. **Agregar nuevos usuarios:**
   ```bash
   python process_letterboxd.py --zip usuario2.zip --fetch-posters
   # El script actualiza data.json automáticamente
   ```

4. **La aplicación cargará automáticamente:**
   - Todos los usuarios precargados
   - Información de películas con pósters
   - Opción de agregar nuevos usuarios sin perder datos

## Características de la Aplicación Actualizada

✅ **Carga de datos precargados** - Los usuarios y películas se cargan automáticamente desde `data.json`

✅ **Imágenes de películas** - Se muestran pósters en los resultados de búsqueda cuando están disponibles

✅ **Gestión incremental** - Nuevos usuarios se agregan sin perder información existente

✅ **Toggle de usuarios** - Habilitar/deshabilitar usuarios sin perder sus datos

✅ **Búsqueda mejorada** - Ahora incluye imágenes en los resultados

## Notas Importantes

- El archivo `data.json` por defecto se guarda en `web/data.json`
- Si no existe, la aplicación continúa funcionando en modo manual (upload de ZIP)
- Los pósters se obtienen del meta tag `og:image` de Letterboxd
- Para obtener pósters requiere conexión a internet
- Los datos son completamente incrementales: no se sobrescriben usuarios existentes

## Ejemplo Completo de Flujo

```bash
# 1. Procesar primer usuario
python process_letterboxd.py --zip exports/user1.zip --fetch-posters

# 2. Procesar segundo usuario (mantiene user1)
python process_letterboxd.py --zip exports/user2.zip --fetch-posters

# 3. Procesar batch de usuarios
python process_letterboxd.py --batch exports/ --fetch-posters

# 4. Copiar a web
cp data.json web/

# 5. Abrir aplicación - verá todos los usuarios precargados
```

## Solución de Problemas

**Q: "No se cargan los datos precargados"**
- A: Verifica que `data.json` esté en la carpeta `web/`
- A: Abre la consola de desarrollador (F12) para ver errores

**Q: "No se cargan los pósters"**
- A: Usa la opción `--fetch-posters` al procesar ZIPs
- A: Comprueba que tienes conexión a internet
- A: Los pósters pueden no estar disponibles para todas las películas

**Q: "¿Cómo actualizar datos de un usuario existente?"**
- A: Procesa el ZIP actualizado de ese usuario - el script actualiza automáticamente
- A: O elimina manualmente al usuario en el JSON y reprocesa

