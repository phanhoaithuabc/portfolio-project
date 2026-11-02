import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import {
  getPortfolioImageFormat,
  portfolioMediaIdFromFilename,
  type PortfolioMediaFile,
  type PortfolioMediaStore,
  type PortfolioMediaUpload,
} from "./media.ts";

interface S3PortfolioMediaOptions {
  bucket: string;
  region: string;
  endpoint?: string;
  prefix?: string;
}

export class S3PortfolioMediaStore implements PortfolioMediaStore {
  private readonly client: S3Client;
  private readonly prefix: string;

  constructor(
    private readonly options: S3PortfolioMediaOptions,
    client?: S3Client,
  ) {
    this.client =
      client ??
      new S3Client({
        region: options.region,
        endpoint: options.endpoint,
        forcePathStyle: Boolean(options.endpoint),
      });
    this.prefix = `${(options.prefix ?? "portfolio-media").replace(/^\/+|\/+$/g, "")}/`;
  }

  async save(data: Buffer): Promise<PortfolioMediaUpload> {
    const format = getPortfolioImageFormat(data);
    const id = randomUUID();
    const filename = `${id}.${format.extension}`;
    await this.putExisting(filename, data, format.type);
    return {
      id,
      filename,
      url: `/media/${filename}`,
      type: format.type,
      size: data.length,
      updatedAt: new Date().toISOString(),
    };
  }

  async putExisting(filename: string, data: Buffer, contentType?: string) {
    const format = getPortfolioImageFormat(data);
    const id = portfolioMediaIdFromFilename(filename);
    if (!id || !filename.endsWith(`.${format.extension}`))
      throw new Error("Existing media filename does not match its image type.");
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: `${this.prefix}${filename}`,
        Body: data,
        ContentType: contentType ?? format.type,
        CacheControl: "public,max-age=31536000,immutable",
      }),
    );
  }

  async list(): Promise<PortfolioMediaFile[]> {
    const files: PortfolioMediaFile[] = [];
    let continuationToken: string | undefined;
    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.options.bucket,
          Prefix: this.prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const object of result.Contents ?? []) {
        const filename = object.Key?.slice(this.prefix.length);
        if (!filename) continue;
        const id = portfolioMediaIdFromFilename(filename);
        if (!id) continue;
        const extension = filename.slice(filename.lastIndexOf(".") + 1);
        const type = extension === "jpg" ? "image/jpeg" : `image/${extension}`;
        files.push({
          id,
          url: `/media/${filename}`,
          type,
          size: object.Size ?? 0,
          updatedAt: (object.LastModified ?? new Date(0)).toISOString(),
        });
      }
      continuationToken = result.NextContinuationToken;
    } while (continuationToken);
    return files.sort((first, second) =>
      second.updatedAt.localeCompare(first.updatedAt),
    );
  }

  async read(filename: string) {
    if (!portfolioMediaIdFromFilename(filename)) return undefined;
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.options.bucket,
          Key: `${this.prefix}${filename}`,
        }),
      );
      const data = await result.Body?.transformToByteArray();
      if (!data) return undefined;
      return {
        data: Buffer.from(data),
        type: result.ContentType ?? "application/octet-stream",
      };
    } catch (error) {
      if (
        error instanceof Error &&
        "$metadata" in error &&
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404
      )
        return undefined;
      throw error;
    }
  }

  async remove(id: string) {
    const file = (await this.list()).find((item) => item.id === id);
    if (!file) return false;
    const filename = file.url.slice("/media/".length);
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.options.bucket,
        Key: `${this.prefix}${filename}`,
      }),
    );
    return true;
  }
}
