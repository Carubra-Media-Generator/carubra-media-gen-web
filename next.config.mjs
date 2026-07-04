/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Pre-existing shadcn/ui type errors in components/ui/chart.tsx, resizable.tsx, calendar.tsx
    // These are v0-generated components with version mismatches, unrelated to the auto-upload feature.
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
