python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

python -m uvicorn main:asgi_app --reload --host 0.0.0.0 --port 8000

# UML Editor Backend

Backend API para la aplicación UML Editor construida con FastAPI.

## Características

- FastAPI framework para desarrollo rápido de APIs
- Documentación automática de API con Swagger/OpenAPI
- Configuración CORS para desarrollo frontend
- Endpoints básicos de salud y información

## Instalación

### Prerequisitos

1. **Python 3.7+** instalado
2. **PostgreSQL** instalado y ejecutándose
3. Base de datos `uml_editor` creada en PostgreSQL

### Configuración de la Base de Datos

1. Instala PostgreSQL si no lo tienes instalado
2. Crea la base de datos:
```sql
CREATE DATABASE uml_editor;
```

3. Ejecuta el script de migración:
```bash
psql -U postgres -d uml_editor -f init_database.sql
```

### Instalación del Proyecto

1. Clona este repositorio
2. Navega al directorio del proyecto
3. Copia el archivo de configuración:
```bash
copy .env.example .env
```

4. Edita el archivo `.env` con tu configuración de PostgreSQL:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=tu_usuario_postgres
DB_PASSWORD=tu_password
DB_NAME=uml_editor
```

5. Instala las dependencias:
```bash
pip install -r requirements.txt
```

## Ejecución

Para ejecutar el servidor de desarrollo:

```bash
python main.py
```

O usando uvicorn directamente:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

El servidor estará disponible en: http://localhost:8000

## Documentación de la API

Una vez que el servidor esté ejecutándose, puedes acceder a:

- Documentación interactiva (Swagger UI): http://localhost:8000/docs
- Documentación alternativa (ReDoc): http://localhost:8000/redoc
- Esquema OpenAPI: http://localhost:8000/openapi.json

## Endpoints disponibles

- `GET /` - Mensaje de bienvenida
- `GET /health` - Verificación de estado del servidor
- `GET /info` - Información de la API

## Estructura del proyecto

```
uml-editor-backend/
├── main.py              # Aplicación principal de FastAPI
├── requirements.txt     # Dependencias del proyecto
├── .gitignore          # Archivos a ignorar en git
└── README.md           # Este archivo
```

## Desarrollo

Para desarrollar con recarga automática, usa la opción `--reload` con uvicorn:

```bash
uvicorn main:app --reload
```

## Próximos pasos

- Agregar modelos de datos con Pydantic
- Implementar endpoints para funcionalidades UML
- Configurar base de datos
- Agregar autenticación y autorización
- Implementar tests unitarios