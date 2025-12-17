#!/usr/bin/env python3
"""
Script de prueba rápida para verificar la configuración del backend
Ejecuta este script después de configurar PostgreSQL y antes de iniciar el servidor
"""

import os
import sys
import asyncio
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

def check_env_variables():
    """Verifica que las variables de entorno estén configuradas"""
    print("🔍 Verificando variables de entorno...")
    
    required_vars = {
        "DB_HOST": os.getenv("DB_HOST"),
        "DB_PORT": os.getenv("DB_PORT"),
        "DB_USER": os.getenv("DB_USER"),
        "DB_PASSWORD": os.getenv("DB_PASSWORD"),
        "DB_NAME": os.getenv("DB_NAME"),
        "JWT_SECRET_KEY": os.getenv("JWT_SECRET_KEY"),
    }
    
    missing = []
    for var, value in required_vars.items():
        if not value:
            missing.append(var)
        else:
            # Ocultar contraseñas en el output
            display_value = "***" if "PASSWORD" in var or "SECRET" in var else value
            print(f"  ✅ {var}: {display_value}")
    
    if missing:
        print(f"\n❌ Variables faltantes: {', '.join(missing)}")
        print("   Por favor, configura estas variables en tu archivo .env")
        return False
    
    print("  ✅ Todas las variables de entorno están configuradas\n")
    return True

async def test_database_connection():
    """Prueba la conexión a la base de datos"""
    print("🗄️  Probando conexión a la base de datos...")
    
    try:
        from database import connect_db, disconnect_db, database
        
        await connect_db()
        print("  ✅ Conexión a PostgreSQL exitosa")
        
        # Verificar que las tablas existen
        query = """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """
        tables = await database.fetch_all(query)
        table_names = [row[0] for row in tables]
        
        expected_tables = ['users', 'projects', 'diagrams', 'shares']
        missing_tables = [t for t in expected_tables if t not in table_names]
        
        if missing_tables:
            print(f"  ⚠️  Tablas faltantes: {', '.join(missing_tables)}")
            print("     Ejecuta: psql -U postgres -d uml_editor -f init_database.sql")
            await disconnect_db()
            return False
        else:
            print(f"  ✅ Tablas encontradas: {', '.join(table_names)}")
        
        await disconnect_db()
        print("  ✅ Desconexión exitosa\n")
        return True
        
    except Exception as e:
        print(f"  ❌ Error de conexión: {str(e)}")
        print("     Verifica:")
        print("     1. PostgreSQL está corriendo")
        print("     2. La base de datos 'uml_editor' existe")
        print("     3. Las credenciales en .env son correctas")
        return False

def test_imports():
    """Verifica que todas las dependencias estén instaladas"""
    print("📦 Verificando dependencias de Python...")
    
    required_modules = [
        'fastapi',
        'uvicorn',
        'databases',
        'asyncpg',
        'jose',
        'passlib',
        'python_dotenv'
    ]
    
    missing = []
    for module in required_modules:
        try:
            # Algunos módulos tienen nombres diferentes al importar
            import_name = module.replace('-', '_')
            if module == 'python_dotenv':
                import_name = 'dotenv'
            elif module == 'jose':
                import_name = 'jose.jwt'
            
            __import__(import_name)
            print(f"  ✅ {module}")
        except ImportError:
            missing.append(module)
            print(f"  ❌ {module} (no instalado)")
    
    if missing:
        print(f"\n❌ Módulos faltantes: {', '.join(missing)}")
        print("   Ejecuta: pip install -r requirements.txt")
        return False
    
    print("  ✅ Todas las dependencias están instaladas\n")
    return True

async def main():
    """Función principal"""
    print("=" * 60)
    print("🧪 PRUEBA DE CONFIGURACIÓN - UML Editor Backend")
    print("=" * 60)
    print()
    
    # Verificar imports
    if not test_imports():
        sys.exit(1)
    
    # Verificar variables de entorno
    if not check_env_variables():
        sys.exit(1)
    
    # Verificar conexión a base de datos
    if not await test_database_connection():
        sys.exit(1)
    
    print("=" * 60)
    print("✅ ¡Todo está configurado correctamente!")
    print("=" * 60)
    print()
    print("🚀 Puedes iniciar el servidor con:")
    print("   python main.py")
    print()
    print("   O con uvicorn:")
    print("   uvicorn main:app --reload --host 0.0.0.0 --port 8000")
    print()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Prueba cancelada por el usuario")
        sys.exit(1)


