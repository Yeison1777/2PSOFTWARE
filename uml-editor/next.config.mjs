/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  // Configuración para prevenir errores de hidratación
  experimental: {
    optimizeCss: false,
    // Mejorar la hidratación
    optimizePackageImports: [],
  },
  // Configuración para prevenir errores de hidratación
  reactStrictMode: true,
  // Configuración adicional para hidratación
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Forzar renderizado solo en cliente para páginas problemáticas
  output: 'standalone',
}

export default nextConfig
