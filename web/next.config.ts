import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Next.js caps Server Action request bodies at 1MB by default — well
      // under lib/photo-upload.ts's own 8MB MAX_BYTES, and well under what a
      // real phone camera photo actually is. Without this, a real photo
      // upload (identify, tank photos, quick-add-morph — anything posting a
      // <form action={serverAction}> with a file input) gets rejected by the
      // framework before it ever reaches our code: no error is returned to
      // catch, Supabase never sees a request, and with no app/error.tsx
      // boundary the user just gets an unhandled client-side crash instead
      // of a message. 10mb covers the 8MB file plus multipart/form overhead.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
