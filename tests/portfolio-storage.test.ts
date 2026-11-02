import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { FilePortfolio } from "../services/portfolio/src/file-repository.ts";
import {
  listPortfolioImages,
  MAX_PORTFOLIO_IMAGE_BYTES,
  removePortfolioImage,
  savePortfolioImage,
} from "../services/portfolio/src/media.ts";
import { S3PortfolioMediaStore } from "../services/portfolio/src/s3-media.ts";
test("explicit local portfolio preview persists content and serializes revision writes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-test-"));
  try {
    const file = join(directory, "content.json");
    const repository = new FilePortfolio(file);
    const content = await repository.read();
    content.profile.name = "Updated Name";
    const results = await Promise.all([
      repository.save(content),
      repository.save(content),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    const restarted = await new FilePortfolio(file).read();
    assert.equal(restarted.profile.name, "Updated Name");
    assert.equal(restarted.revision, 1);
    const restartedRepository = new FilePortfolio(file);
    const versions = await restartedRepository.listVersions();
    assert.deepEqual(
      versions.map((version) => version.revision),
      [0],
    );
    const restored = await restartedRepository.restoreVersion(0, 1);
    assert.equal(restored?.profile.name, "Phan Hoai Thu");
    assert.equal(restored?.revision, 2);
    const contact = await restartedRepository.createContact({
      name: "Visitor",
      email: "visitor@example.com",
      subject: "Hello",
      message: "Please contact me about this project.",
    });
    assert.equal(
      (await restartedRepository.listContacts(10))[0]?.id,
      contact.id,
    );
    assert.equal(
      (await restartedRepository.updateContactStatus(contact.id, "read"))
        ?.status,
      "read",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("portfolio media accepts known image signatures and rejects active content", async () => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-media-test-"));
  try {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    const uploaded = await savePortfolioImage(png, directory);
    assert.match(uploaded.url, /^\/media\/[0-9a-f-]+\.png$/);
    assert.equal(uploaded.type, "image/png");
    assert.equal((await listPortfolioImages(directory)).length, 1);
    await assert.rejects(() =>
      savePortfolioImage(
        Buffer.from("<svg><script>alert(1)</script></svg>"),
        directory,
      ),
    );
    await assert.rejects(() =>
      savePortfolioImage(
        Buffer.alloc(MAX_PORTFOLIO_IMAGE_BYTES + 1),
        directory,
      ),
    );
    assert.equal(await removePortfolioImage(uploaded.id, directory), true);
    assert.equal((await listPortfolioImages(directory)).length, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("S3 portfolio media preserves stable URLs and stores private object keys", async () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const objects = new Map<string, { body: Buffer; type: string }>();
  const client = {
    async send(command: unknown) {
      if (command instanceof PutObjectCommand) {
        objects.set(command.input.Key!, {
          body: Buffer.from(command.input.Body as Buffer),
          type: command.input.ContentType!,
        });
        return {};
      }
      if (command instanceof ListObjectsV2Command) {
        return {
          Contents: [...objects.entries()].map(([Key, object]) => ({
            Key,
            Size: object.body.length,
            LastModified: new Date("2026-01-01T00:00:00Z"),
          })),
        };
      }
      if (command instanceof GetObjectCommand) {
        const object = objects.get(command.input.Key!);
        if (!object) throw new Error("not found");
        return {
          ContentType: object.type,
          Body: { transformToByteArray: async () => object.body },
        };
      }
      if (command instanceof DeleteObjectCommand) {
        objects.delete(command.input.Key!);
        return {};
      }
      throw new Error("Unexpected S3 command");
    },
  } as unknown as S3Client;
  const store = new S3PortfolioMediaStore(
    { bucket: "portfolio-test", region: "us-east-1" },
    client,
  );
  const uploaded = await store.save(png);
  assert.match(uploaded.url, /^\/media\/[0-9a-f-]+\.png$/);
  assert.equal(objects.size, 1);
  assert.deepEqual((await store.read(uploaded.filename))?.data, png);
  assert.equal((await store.list())[0]?.type, "image/png");
  assert.equal(await store.remove(uploaded.id), true);
  assert.equal(objects.size, 0);
});
