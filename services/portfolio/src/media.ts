import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

export const MAX_PORTFOLIO_IMAGE_BYTES = 8 * 1024 * 1024;

export interface PortfolioMediaFile {
  id: string;
  url: string;
  type: string;
  size: number;
  updatedAt: string;
}

export interface PortfolioMediaUpload extends PortfolioMediaFile {
  filename: string;
}

export interface PortfolioMediaStore {
  save(data: Buffer): Promise<PortfolioMediaUpload>;
  list(): Promise<PortfolioMediaFile[]>;
  read(filename: string): Promise<{ data: Buffer; type: string } | undefined>;
  remove(id: string): Promise<boolean>;
}

const formats = [
  {
    extension: "png",
    type: "image/png",
    matches: (data: Buffer) =>
      data.length >= 8 &&
      data
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    extension: "jpg",
    type: "image/jpeg",
    matches: (data: Buffer) =>
      data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255,
  },
  {
    extension: "gif",
    type: "image/gif",
    matches: (data: Buffer) =>
      data.length >= 6 &&
      ["GIF87a", "GIF89a"].includes(data.subarray(0, 6).toString("ascii")),
  },
  {
    extension: "webp",
    type: "image/webp",
    matches: (data: Buffer) =>
      data.length >= 12 &&
      data.subarray(0, 4).toString("ascii") === "RIFF" &&
      data.subarray(8, 12).toString("ascii") === "WEBP",
  },
] as const;

function detectImage(data: Buffer) {
  return formats.find((format) => format.matches(data));
}

export function getPortfolioImageFormat(data: Buffer) {
  if (!data.length || data.length > MAX_PORTFOLIO_IMAGE_BYTES)
    throw new Error("Image must be between 1 byte and 8 MiB.");
  const format = detectImage(data);
  if (!format) throw new Error("Upload a PNG, JPEG, GIF, or WebP image.");
  return format;
}

export function portfolioMediaIdFromFilename(filename: string) {
  return mediaIdFromFilename(filename);
}

function mediaIdFromFilename(filename: string) {
  const match = filename.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(png|jpg|gif|webp)$/i,
  );
  return match?.[1];
}

export async function savePortfolioImage(data: Buffer, directory: string) {
  const format = getPortfolioImageFormat(data);
  await mkdir(directory, { recursive: true, mode: 0o750 });
  const id = randomUUID();
  const filename = `${id}.${format.extension}`;
  await writeFile(join(directory, filename), data, { flag: "wx", mode: 0o640 });
  return {
    id,
    filename,
    url: `/media/${filename}`,
    type: format.type,
    size: data.length,
  };
}

export async function listPortfolioImages(
  directory: string,
): Promise<PortfolioMediaFile[]> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return [];
    throw error;
  }
  const files = await Promise.all(
    names.map(async (name): Promise<PortfolioMediaFile | null> => {
      const id = mediaIdFromFilename(name);
      if (!id) return null;
      const info = await stat(join(directory, name));
      if (!info.isFile()) return null;
      const extension = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
      const type = formats.find(
        (format) => format.extension === extension,
      )?.type;
      if (!type) return null;
      return {
        id,
        url: `/media/${name}`,
        type,
        size: info.size,
        updatedAt: info.mtime.toISOString(),
      };
    }),
  );
  return files
    .filter((file): file is PortfolioMediaFile => file !== null)
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}

export async function removePortfolioImage(id: string, directory: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    return false;
  const matches = (await listPortfolioImages(directory)).find(
    (file) => file.id === id,
  );
  if (!matches) return false;
  await unlink(join(directory, matches.url.slice("/media/".length)));
  return true;
}

export class FilePortfolioMediaStore implements PortfolioMediaStore {
  constructor(private readonly directory: string) {}

  async save(data: Buffer) {
    const uploaded = await savePortfolioImage(data, this.directory);
    return { ...uploaded, updatedAt: new Date().toISOString() };
  }

  list() {
    return listPortfolioImages(this.directory);
  }

  async read(filename: string) {
    if (!mediaIdFromFilename(filename)) return undefined;
    const extension = filename.slice(filename.lastIndexOf(".") + 1);
    const type = formats.find((format) => format.extension === extension)?.type;
    if (!type) return undefined;
    try {
      return { data: await readFile(join(this.directory, filename)), type };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return undefined;
      throw error;
    }
  }

  remove(id: string) {
    return removePortfolioImage(id, this.directory);
  }
}
