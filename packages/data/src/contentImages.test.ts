import { describe, expect, it, vi } from "vitest";

import { uploadContentImage } from "./contentImages";

function client(uploadError: unknown = null) {
  const bucket = {
    upload: vi.fn().mockResolvedValue({ data: {}, error: uploadError }),
    getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/content/${path}` } })),
  };
  const from = vi.fn(() => bucket);
  return { db: { storage: { from } } as never, bucket, from };
}

const image = { body: new ArrayBuffer(4), contentType: "image/jpeg", ext: "jpg", id: "abc" };

describe("uploadContentImage", () => {
  it("uploads to the folder under a unique name and returns the public URL", async () => {
    const { db, bucket, from } = client();
    const url = await uploadContentImage(db, "feedback", image);

    expect(from).toHaveBeenCalledWith("content");
    expect(bucket.upload).toHaveBeenCalledWith("feedback/abc.jpg", image.body, { contentType: "image/jpeg", upsert: false });
    expect(url).toBe("https://x.supabase.co/storage/v1/object/public/content/feedback/abc.jpg");
  });

  it("throws when Storage refuses the upload", async () => {
    const { db } = client({ message: "new row violates row-level security policy" });
    await expect(uploadContentImage(db, "feedback", image)).rejects.toEqual({ message: "new row violates row-level security policy" });
  });
});
