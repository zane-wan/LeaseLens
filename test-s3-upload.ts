import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "ca-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

async function main() {
  try {
    const bucketName = process.env.AWS_S3_BUCKET;
    console.log("Bucket Name:", bucketName);
    const key = `test/test-file-${Date.now()}.pdf`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: "application/pdf",
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 600 });
    console.log("Presigned URL generated:", url);

    console.log("Attempting to upload with fetch...");
    const dummyContent = new Uint8Array([1, 2, 3, 4]);
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/pdf",
      },
      body: dummyContent,
    });

    if (response.ok) {
      console.log("Upload succeeded!");
    } else {
      console.error("Upload failed with status:", response.status, response.statusText);
      const text = await response.text();
      console.error("Response body:", text);
    }
  } catch (error) {
    console.error("Exception:", error);
  }
}

main();
