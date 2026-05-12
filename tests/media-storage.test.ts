import test from "node:test";
import assert from "node:assert/strict";

import {
  buildR2PublicUrl,
  createR2ObjectKey,
  isAllowedUserImageMimeType,
} from "../src/server/media-storage";

test("R2 public URLs encode object key segments without changing path structure", () => {
  assert.equal(
    buildR2PublicUrl("https://media.o3origin.com/", "profile_avatar/user_1/2026/05/my image.png"),
    "https://media.o3origin.com/profile_avatar/user_1/2026/05/my%20image.png",
  );
});

test("R2 object keys are scoped by purpose and sanitized user id", () => {
  const key = createR2ObjectKey({
    userId: "user bad/id",
    purpose: "profile_avatar",
    fileName: "avatar.jpeg",
    mimeType: "image/jpeg",
  });

  assert.match(key, /^profile_avatar\/user_bad_id\/\d{4}\/\d{2}\/[a-f0-9-]+\.jpeg$/u);
});

test("user image uploads only allow browser-renderable image MIME types", () => {
  assert.equal(isAllowedUserImageMimeType("image/jpeg"), true);
  assert.equal(isAllowedUserImageMimeType("image/png"), true);
  assert.equal(isAllowedUserImageMimeType("application/pdf"), false);
});
