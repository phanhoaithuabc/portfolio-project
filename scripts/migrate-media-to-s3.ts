import { readFile } from "node:fs/promises";
import { listPortfolioImages } from "../services/portfolio/src/media.ts";
import { S3PortfolioMediaStore } from "../services/portfolio/src/s3-media.ts";

const directory = process.env.PORTFOLIO_UPLOAD_DIR ?? "data/uploads";
const files = await listPortfolioImages(directory);
const apply = process.argv.includes("--apply");
if (!apply) {
  console.log(`Dry run: ${files.length} media files would be copied to S3.`);
  console.log("Pass --apply to copy files; original files will be retained.");
  process.exit(0);
}

const bucket = process.env.PORTFOLIO_MEDIA_S3_BUCKET;
const region = process.env.PORTFOLIO_MEDIA_S3_REGION ?? process.env.AWS_REGION;
if (!bucket || !region)
  throw new Error("PORTFOLIO_MEDIA_S3_BUCKET and region are required.");
const store = new S3PortfolioMediaStore({
  bucket,
  region,
  endpoint: process.env.PORTFOLIO_MEDIA_S3_ENDPOINT,
  prefix: process.env.PORTFOLIO_MEDIA_S3_PREFIX,
});
for (const file of files) {
  const filename = file.url.slice("/media/".length);
  const data = await readFile(`${directory}/${filename}`);
  await store.putExisting(filename, data, file.type);
}
console.log(
  `Copied ${files.length} media files to S3; local originals retained.`,
);
