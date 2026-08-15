/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdfjs-dist referencia 'canvas' (opcional, só Node) — ignorar no bundle do navegador
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
      encoding: false,
    };
    return config;
  },
};

export default nextConfig;
